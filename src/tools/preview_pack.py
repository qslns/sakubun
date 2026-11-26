#!/usr/bin/env python3
"""미리 보기 카드(claude.ai artifact)에 올릴 판을 pv/ 에 만듦.
사이트(site/)와 같은 내용. 다른 점은 음성뿐: 카드 하나에 파일을 512개까지만 올릴 수 있어서, 클립 파일을 외우는 순서대로 이어 붙여
audio/p<번호>.mp3 묶음으로 만들고 data.js 에 pk = {i: {클립: [묶음 번호, 시작, 길이]}} 를 넣음(앱이 거기서 잘라서 씀).
소스 백업도 pv/src/ 에 넣음(.py 는 .py.txt).   python3 src/tools/preview_pack.py"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE, PV = os.path.join(ROOT, "site"), os.path.join(ROOT, "pv")
PACK = 700 * 1024   # 묶음 하나의 크기(쯤)
shutil.rmtree(PV, ignore_errors=True)
os.makedirs(os.path.join(PV, "audio"))
for f in ("index.html", "app.js", "version.json"):
    shutil.copy(os.path.join(SITE, f), os.path.join(PV, f))
data = open(os.path.join(SITE, "data.js"), encoding="utf-8").read()
head = "window.DATA="
D = json.loads(data[len(head):data.index(";window.DATA.ver=")])

# 외우는 순서대로 클립을 늘어놓음: 단위(질문 → 문장) → 예상 질문(질문 → 짧은 답) → 나머지
order, seen = [], set()


def add(h):
    if h and h not in seen:
        seen.add(h)
        order.append(h)


U = {u["id"]: u for u in D["units"]}
for uid in D["order"]:
    u = U[uid]
    if u.get("q"):
        add(u["q"].get("auk"))
        add(u["q"].get("au"))
    for sid in u["s"]:
        add(D["sents"][sid].get("au"))
for q in D["qs"]:
    add(q.get("auk"))
    add(q.get("au"))
    for a in q["a"]:
        if "sa" in a:
            add(a["sa"].get("au"))
for s in D["sents"].values():
    add(s.get("au"))
files = sorted(f[:-4] for f in os.listdir(os.path.join(SITE, "audio")) if f.endswith(".mp3"))
left = [h for h in files if h not in seen]
if left:
    sys.exit("data.js 에서 찾지 못한 음성 파일 %d개: %s" % (len(left), left[:3]))
miss = [h for h in order if h not in set(files)]
if miss:
    sys.exit("음성 파일 없음 %d개: %s" % (len(miss), miss[:3]))

idx, k, buf = {}, 0, b""
for h in order:
    b = open(os.path.join(SITE, "audio", h + ".mp3"), "rb").read()
    if buf and len(buf) + len(b) > PACK:
        open(os.path.join(PV, "audio", "p%d.mp3" % k), "wb").write(buf)
        k, buf = k + 1, b""
    idx[h] = [k, len(buf), len(b)]
    buf += b
if buf:
    open(os.path.join(PV, "audio", "p%d.mp3" % k), "wb").write(buf)
    k += 1
data = data.replace(head + "{", head + '{"pk":' + json.dumps({"i": idx}, separators=(",", ":")) + ",", 1)
open(os.path.join(PV, "data.js"), "w", encoding="utf-8").write(data)

# 소스 백업
n_src = 0
for base, dirs, fs in os.walk(os.path.join(ROOT, "src")):
    dirs[:] = [d for d in dirs if d not in ("kvg", "shots", "__pycache__")]
    for f in fs:
        if f.endswith((".bak", ".pyc", ".tsv")) or f in ("vocab_words.json", "audio_jobs.json", "asr_report.json", "content_src_v2.py"):
            continue
        rel = os.path.relpath(os.path.join(base, f), ROOT)
        dst = os.path.join(PV, rel + (".txt" if f.endswith(".py") else ""))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy(os.path.join(base, f), dst)
        n_src += 1
for f, d in (("PROGRESS.md", "src/PROGRESS.md"), ("review/문장.md", "src/review/sentences_full.md")):
    if os.path.exists(os.path.join(ROOT, f)):
        os.makedirs(os.path.dirname(os.path.join(PV, d)), exist_ok=True)
        shutil.copy(os.path.join(ROOT, f), os.path.join(PV, d))
        n_src += 1
print("pv/: 음성 %d개 → 묶음 %d개 · 소스 %d개" % (len(order), k, n_src))
