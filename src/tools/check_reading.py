#!/usr/bin/env python3
"""후리가나 검사: 내가 단 읽기와 사전(OpenJTalk)이 읽는 방식이 다른 문장을 뽑아 줌(사람이 다시 볼 목록).
조사 は・へ, 장음 표기 차이는 맞춰서 비교."""
import json, os, re, sys, warnings
warnings.filterwarnings("ignore")
import pyopenjtalk

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)


def phon(text):
    out = []
    for t in pyopenjtalk.g2p(text).split():
        if t in ("pau", "sil"):
            continue
        t = {"I": "i", "U": "u"}.get(t, t)
        if out and ((t == "i" and out[-1] == "e") or (t == "u" and out[-1] == "o")):
            t = out[-1]
        out.append(t)
    if out[-4:] == ["t", "o", "y", "u"]:
        pass
    return " ".join(out).replace("t o y u u", "t o i u").split()


def main():
    jobs = json.load(open(os.path.join(ROOT, "src", "content", "audio_jobs.json"), encoding="utf-8"))
    bad = 0
    for h, j in sorted(jobs.items(), key=lambda x: x[1]["id"]):
        a, b = phon(j["kana"]), phon(j["text"])
        if a != b:
            bad += 1
            print("%s  %s" % (j["id"], j["text"]))
            print("   내 읽기 : %s\n   사전 읽기: %s" % (j["kana"], pyopenjtalk.g2p(j["text"], kana=True)))
    print("문장 %d · 읽기가 사전과 다른 것 %d" % (len(jobs), bad))


if __name__ == "__main__":
    main()
