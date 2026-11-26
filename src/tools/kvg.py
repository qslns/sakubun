#!/usr/bin/env python3
"""낱말 사전에 나오는 한자·가타카나의 획순 자료(KanjiVG, CC BY-SA 3.0)를 src/kvg/ 에 받아 둠."""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KDIR = os.path.join(ROOT, "kvg")
BASE = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/%05x.svg"


def main():
    content = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "content", "content.json")
    C = json.load(open(content, encoding="utf-8"))
    chars = set()
    for w in C.get("words", {}).values():
        for ch in w["w"]:
            if re.match(r"[一-鿿々ァ-ヺー]", ch):
                chars.add(ch)
    os.makedirs(KDIR, exist_ok=True)
    got = miss = 0
    for ch in sorted(chars):
        f = os.path.join(KDIR, "%05x.svg" % ord(ch))
        if os.path.exists(f) and os.path.getsize(f) > 200:
            continue
        r = subprocess.run(["curl", "-s", "-m", "30", "-f", "-o", f, BASE % ord(ch)])
        if r.returncode != 0 or not os.path.exists(f) or os.path.getsize(f) < 200:
            miss += 1
            if os.path.exists(f):
                os.remove(f)
            print("없음:", ch)
        else:
            got += 1
    print("글자 %d · 새로 받음 %d · 없음 %d" % (len(chars), got, miss))


if __name__ == "__main__":
    main()
