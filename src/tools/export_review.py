#!/usr/bin/env python3
"""검토용 문서 뽑기: review/v3/sentences_<tag>.md · questions_<tag>.md · cloze_blind_<tag>.md · cloze_key_<tag>.json · unseen_<tag>.md
  python3 src/tools/export_review.py v3b"""
import json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "review", "v3")
RUBY = re.compile(r"\[([^\[\]|]+)\|([^\[\]|]+)\]")


def split_top(s):
    out, cur, d = [], "", 0
    for ch in s:
        if ch == "[":
            d += 1
        elif ch == "]":
            d -= 1
        if ch == "|" and d == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def resolved(src):
    return re.sub(r"\{([^{}]*)\}", lambda m: split_top(m.group(1))[0], src.replace("/", ""))


def plain(src):
    return RUBY.sub(lambda m: m.group(1), resolved(src))


def kana(src):
    return RUBY.sub(lambda m: m.group(2), resolved(src))


def cloze_items(src):
    s, items = src.replace("/", ""), []
    for m in re.finditer(r"\{([^{}]*)\}", s):
        opts = [RUBY.sub(lambda x: x.group(1), o) for o in split_top(m.group(1))]
        items.append((plain(s[:m.start()]) + "（　　）" + plain(s[m.end():]), opts))
    return items


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "v3x"
    C = json.load(open(os.path.join(ROOT, "src", "content", "content.json"), encoding="utf-8"))
    L = ["# 문장 세트 (검토용 %s) — 일본어 / 한국어 뜻 / 출처 / 상태" % tag,
         "상태: ok = 출처가 확실 · chk = 만든 쪽이 채운 말이 들어가서 본인 확인 필요 · pend = 본인 답을 기다리는 초안", ""]
    allS, byid = [], {}

    def add(sid, s, extra=""):
        p = plain(s["ja"])
        allS.append((sid, s, p)); byid[sid] = p
        L.append("- `%s` %s (%d자)%s\n  - 뜻: %s\n  - 출처: %s · 상태: %s%s" % (
            sid, p, len(p), extra, s["ko"], s.get("src", ""), s.get("st", "ok"), (" · (다시 씀: %s)" % s["ref"]) if s.get("ref") else ""))

    L.append("## 블록 8개 (작문 본문 + 면접 답. 3문장씩)")
    for b in C["blocks"]:
        L.append("\n### %s %s — 질문: %s" % (b["id"], b["ko"], plain(b["q"]["ja"])))
        for i, s in enumerate(b["s"], 1):
            add("%s.%d" % (b["id"], i), s)
    L.append("\n## 작문 주제 15개 + 틀(주제 16). 조립 = 첫 문장(1단) + 본문(2단: 블록·전용 문장) + 끝 문장(3단)")
    for t in C["topics"]:
        L.append("\n### %s %s 「%s」 본문: %s" % (t["id"], t["ko"], plain(t["ja"]), " → ".join(t["body"]) if t["body"] else "(틀 문장 모음 — 처음 보는 주제에 씀)"))
        add(t["id"] + ".f", t["first"], " [첫 문장%s]" % ((" · 틀:" + t["first"]["fr"]) if t["first"].get("fr") else ""))
        for i, s in enumerate(t["extra"], 1):
            add("%s.x%d" % (t["id"], i), s, " [전용%s]" % ((" · 틀:" + s["fr"]) if s.get("fr") else ""))
        add(t["id"] + ".l", t["last"], " [끝 문장%s]" % ((" · 틀:" + t["last"]["fr"]) if t["last"].get("fr") else ""))
    L.append("\n## 면접 답 45개")
    for u in C["iv"]:
        L.append("\n### %s %s — 질문: %s (%s)" % (u["id"], u["ko"], plain(u["q"]["ja"]), u["q"]["ko"]))
        for i, s in enumerate(u["s"], 1):
            add("%s.%d" % (u["id"], i), s)
    L.append("\n## 인사·비상 / 시험 날·그룹 면접")
    for u in C["em"]:
        L.append("\n### %s %s" % (u["id"], u["ko"]))
        for i, s in enumerate(u["s"], 1):
            add("%s.%d" % (u["id"], i), s, " [%s]" % s.get("when", ""))
    # 조립한 글 전체
    L.append("\n## 조립한 글 전체 (주제 1~15)")
    bl = {b["id"]: "".join(plain(s["ja"]) for s in b["s"]) for b in C["blocks"]}
    for t in C["topics"]:
        if t.get("frame"):
            continue
        body = "".join(bl[x] if x.startswith("b") else plain(t["extra"][int(x[1:]) - 1]["ja"]) for x in t["body"])
        paras = [plain(t["first"]["ja"]), body, plain(t["last"]["ja"])]
        L.append("\n### %s %s (%d자)\n　%s\n　%s\n　%s" % (t["id"], t["ko"], sum(len(p) for p in paras), paras[0], paras[1], paras[2]))
    open(os.path.join(OUT, "sentences_%s.md" % tag), "w", encoding="utf-8").write("\n".join(L) + "\n")

    Q = ["# 예상 질문 전체 (검토용 %s) — 질문 → 연결된 답" % tag,
         "답 표기: b1:1,2 = 블록 ①의 1·2번 문장 · i5 = 면접 답 5 전체 · t13:f = 주제 13 첫 문장 · e2:3 = 인사 묶음 2의 3번 · [짧은 답] = 이 질문에만 쓰는 한 문장", ""]
    units = {u["id"]: u for u in C["blocks"] + C["iv"] + C["em"]}
    cat = None
    for q in C["qs"]:
        if q["cat"] != cat:
            cat = q["cat"]
            Q.append("\n## %s. %s" % (cat, dict(C["qcats"])[cat]))
        rel = {"fu": "  ↳ (꼬리)", "var": "  ≈ (바꿔 묻기)"}.get(q.get("rel"), "")
        ans = []
        for a in q["a"]:
            if isinstance(a, dict):
                ans.append("[짧은 답] %s (%s) <%s>" % (plain(a["ja"]), a["ko"], a.get("st", "ok")))
            else:
                uid, _, sub = a.partition(":")
                if not sub:
                    n = 2 if uid.startswith("b") else len(units[uid]["s"])
                    sids = ["%s.%d" % (uid, i) for i in range(1, n + 1)]
                else:
                    sids = ["%s.%s" % (uid, k) for k in sub.split(",")]
                ans.append("%s = %s" % (a, " ".join(byid[s] for s in sids)))
        Q.append("- `%s`%s%s %s (%s) 〔%s〕%s\n  - 답: %s" % (q["id"], rel, " [압박]" if q.get("hard") else "", plain(q["ja"]), q["ko"], q.get("src", ""),
                                                        ("\n  - 메모: " + q["note"]) if q.get("note") else "", "\n  - 답: ".join(ans)))
    open(os.path.join(OUT, "questions_%s.md" % tag), "w", encoding="utf-8").write("\n".join(Q) + "\n")

    # 처음 보는 주제
    fr = {}
    for t in C["topics"]:
        if t.get("frame"):
            for s in [t["first"]] + t["extra"] + [t["last"]]:
                fr[s["fr"]] = plain(s["ja"])
    tp = {t["id"]: t for t in C["topics"]}
    Un = ["# 처음 보는 주제 (검토용 %s)" % tag,
          "쓰는 법: 틀 첫 문장 → 주제에 답하는 문장 두세 개(★ 그 자리에서 짓는 부분, 아래는 보기) → 연결 문장(① 내 생각을 쓴 뒤 · ② 사실·일상을 쓴 뒤) → 블록 2개 → 끝 문장. '같은 글' = 준비한 주제의 글을 그대로 씀.", ""]
    for t in C["unseen"]:
        if t.get("same"):
            Un.append("- `%s` 「%s」(%s) → 주제 %s(%s)와 같은 글" % (t["id"], plain(t["ja"]), t["ko"], t["same"], tp[t["same"]]["ko"]))
            continue
        body = "".join("★" + plain(x["ja"]) for x in t["xs"]) + fr["연결%d" % t.get("br", 1)] + "".join(bl[b] for b in t["body"])
        paras = [fr["첫"], body, fr["끝"]]
        Un.append("- `%s` 「%s」(%s) — %d자 · 연결 %d · 블록 %s\n  　%s\n  　%s\n  　%s\n  - 보기 문장 뜻: %s" % (
            t["id"], plain(t["ja"]), t["ko"], sum(len(p.replace("★", "")) for p in paras), t.get("br", 1), "·".join(t["body"]), paras[0], paras[1], paras[2],
            " / ".join("%s <%s>" % (x["ko"], x.get("st", "ok")) for x in t["xs"])))
    open(os.path.join(OUT, "unseen_%s.md" % tag), "w", encoding="utf-8").write("\n".join(Un) + "\n")

    Bz = ["# 빈칸 문제 — 한국어 뜻을 보고 （　　）에 들어갈 말을 고르기. 보기 순서는 섞여 있음.", ""]
    random.seed(11)
    key, n = {}, 0
    for sid, s, p in allS:
        if s.get("ref"):
            continue
        for k, (stem, opts) in enumerate(cloze_items(s["ja"]), 1):
            n += 1
            o = opts[:]
            random.shuffle(o)
            Bz.append("%d. [%s#%d] 뜻: %s\n   %s\n   보기: %s" % (n, sid, k, s["ko"], stem, " / ".join("(%s) %s" % (chr(97 + i), x) for i, x in enumerate(o))))
            key["%s#%d" % (sid, k)] = {"n": n, "ans": chr(97 + o.index(opts[0])), "text": opts[0]}
    open(os.path.join(OUT, "cloze_blind_%s.md" % tag), "w", encoding="utf-8").write("\n".join(Bz) + "\n")
    json.dump(key, open(os.path.join(OUT, "cloze_key_%s.json" % tag), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("%s: 문장 %d · 빈칸 %d · 질문 %d · 처음 보는 주제 %d" % (tag, len(allS), n, len(C["qs"]), len(C["unseen"])))


if __name__ == "__main__":
    main()
