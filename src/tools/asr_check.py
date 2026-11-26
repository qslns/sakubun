#!/usr/bin/env python3
"""음성 받아쓰기 검사: 만든 음성을 음소 인식기로 받아써서 후리가나(기대 읽기)와 비교.
인식기: prj-beatrice/japanese-hubert-base-phoneme-ctc-v4 (일본어 음소 CTC). 기대 읽기: 문장의 히라가나 읽기 -> pyopenjtalk 음소.
  python3 src/tools/asr_check.py [--all]      (기본: 아직 통과 기록이 없는 것만)
결과: src/content/asr_report.json (통과한 해시 기록) + 걸린 것 출력.
"""
import json, os, sys, warnings
warnings.filterwarnings("ignore")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
import numpy as np  # noqa: E402
import torch, librosa, pyopenjtalk  # noqa: E402
from transformers import AutoProcessor, AutoModelForCTC  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ADIR = os.path.join(ROOT, "site", "audio")
JOBS = os.path.join(ROOT, "src", "content", "audio_jobs.json")
REPORT = os.path.join(ROOT, "src", "content", "asr_report.json")
NAME = "prj-beatrice/japanese-hubert-base-phoneme-ctc-v4"
SKIP = {"pau", "sil", "PAD", "SOS", "EOS", "UNK"}


def norm(tokens):
    out = []
    for t in tokens:
        if t in SKIP or not t:
            continue
        t = {"I": "i", "U": "u"}.get(t, t)
        # 장음 표기 차이(えい→ええ, おう→おお)는 같은 소리로 봄
        if out and ((t == "i" and out[-1] == "e") or (t == "u" and out[-1] == "o")):
            t = out[-1]
        out.append(t)
    return out


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def main():
    jobs = json.load(open(JOBS, encoding="utf-8"))
    rep = json.load(open(REPORT, encoding="utf-8")) if os.path.exists(REPORT) else {}
    todo = [h for h in jobs if "--all" in sys.argv or h not in rep.get("ok", {})]
    proc = AutoProcessor.from_pretrained(NAME)
    model = AutoModelForCTC.from_pretrained(NAME).eval()
    id2tok = {v: k for k, v in proc.tokenizer.get_vocab().items()}
    okmap = {} if "--all" in sys.argv else rep.get("ok", {})
    flagged = []
    for n, h in enumerate(todo):
        j = jobs[h]
        f = os.path.join(ADIR, h + ".mp3")
        if not os.path.exists(f):
            flagged.append({"h": h, "id": j["id"], "why": "파일 없음"})
            continue
        wav, _ = librosa.load(f, sr=16000, mono=True)

        def recog(seg):
            # 앞뒤에 무음 0.5초를 붙임: 소리가 파일 맨 앞에서 바로 시작하면 인식기가 첫 마디를 통째로 빠뜨림
            seg = np.concatenate([np.zeros(8000, dtype=seg.dtype), seg, np.zeros(8000, dtype=seg.dtype)])
            with torch.no_grad():
                ids = model(**proc(seg, sampling_rate=16000, return_tensors="pt")).logits.argmax(-1)[0].tolist()
            out, last = [], None
            for i in ids:
                if i != last and i != 0:
                    out.append(id2tok.get(i, ""))
                last = i
            return out

        rec = norm(recog(wav))
        # 긴 쉼(0.3초 이상)에서 잘라 조각마다 받아쓴 것도 만들어 둠: 통째로 넣으면 쉼 앞의 짧은 말("はい。")을 빠뜨릴 때가 있음
        iv = [list(x) for x in librosa.effects.split(wav, top_db=40, frame_length=1024, hop_length=256)]
        merged = []
        for x in iv:
            if merged and x[0] - merged[-1][1] < 4800:
                merged[-1][1] = x[1]
            else:
                merged.append(x)
        rec2 = None
        if len(merged) > 1:
            toks = []
            for k, (a0, b0) in enumerate(merged):
                lo = (merged[k - 1][1] + a0) // 2 if k else 0
                hi = (b0 + merged[k + 1][0]) // 2 if k + 1 < len(merged) else len(wav)
                seg = wav[max(lo, a0 - 1600):min(hi, b0 + 1600)]
                if len(seg) >= 3200:
                    toks += recog(seg)
            rec2 = norm(toks)
        exp_k = norm(pyopenjtalk.g2p(j.get("kana") or j["text"]).split())
        exp_t = norm(pyopenjtalk.g2p(j["text"]).split())
        dk, dtx = lev(rec, exp_k), lev(rec, exp_t)
        if rec2 is not None and lev(rec2, exp_k) < dk:
            rec, dk, dtx = rec2, lev(rec2, exp_k), lev(rec2, exp_t)
        d = min(dk, dtx)
        ratio = d / max(1, len(exp_k))
        best = min(dk, dtx) if j.get("kana") else dk
        if best <= 1 or (best <= 2 and len(exp_k) >= 30):
            okmap[h] = {"id": j["id"], "d": best}
        else:
            flagged.append({"h": h, "id": j["id"], "v": j["v"], "text": j["text"], "d_kana": dk, "d_text": dtx,
                            "ratio": round(ratio, 3), "rec": " ".join(rec), "exp": " ".join(exp_k), "dur": round(len(wav) / 16000, 2)})
    rep["ok"] = {h: v for h, v in okmap.items() if h in jobs}
    rep["flagged"] = flagged
    json.dump(rep, open(REPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("검사 %d · 통과 누적 %d / %d · 걸린 것 %d" % (len(todo), len(rep["ok"]), len(jobs), len(flagged)))
    for x in flagged:
        print("\n ✕ %s [%s] %s  (읽기 기준 %s · 글자 기준 %s)" % (x["id"], x.get("v"), x.get("text"), x.get("d_kana"), x.get("d_text")))
        if "rec" in x:
            print("   들림: " + x["rec"])
            print("   기대: " + x["exp"])


if __name__ == "__main__":
    main()
