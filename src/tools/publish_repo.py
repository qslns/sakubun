#!/usr/bin/env python3
"""공개 저장소(qslns/sakubun)에 올릴 파일을 꾸림.

  python3 src/tools/publish_repo.py /home/claude/sakubun        # 꾸리기 + 검사
  (그다음 저장소 폴더에서 git add -A · commit · push)

- 사이트(site/) → 저장소 맨 위(GitHub Pages 가 main 의 / 를 그대로 내보냄)
- 소스(src/) → 저장소 src/. 단, 문장 원본(c3_essay · c3_iv · c3_q)의 **출처 메모는 괄호 속과 본인 답을 옮긴 말을 지우고** 올림.
  출처 메모에는 서류의 연도·기간 같은 개인 정보가 들어 있어서 공개 저장소에 그대로 두지 않음(표시 이름만 남김: 칸 · 사실0 · 말11/26 …).
  지우기 전의 원본은 작업 폴더와 비공개 미리 보기 카드(src/ 아래 .py.txt)에 있음.
- 꾸린 뒤 검사: ① 지운 소스로 다시 만든 content.json 이 원본과 같은지(출처 칸만 빼고) ② 넣으면 안 되는 말이 없는지.
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE, SRC = os.path.join(ROOT, "site"), os.path.join(ROOT, "src")

# 괄호 속에 본인 서류·말의 자세한 내용이 들어가는 출처 표시
LABEL = re.compile(r"(사실\d|칸|말[\d/·]+|답[\d/]+|2판확인|대응\d|이력서\d*|원서\d*에서|원서\d*|서류|여행|폼|수료 후 예정)\(")
SCRUB = ("c3_essay.py", "c3_iv.py", "c3_q.py")
CONTENT = ("c3_lib.py", "c3_essay.py", "c3_iv.py", "c3_q.py", "c3_rank.py", "c3_words.py", "content_src.py", "md_head.md", "vocab_words.json")
# 공개 저장소에 있으면 안 되는 말(다닌 학교 이름 · 사는 곳 · 전화 등)의 목록. 목록 자체가 개인 정보라서 저장소 밖(작업 폴더의 private_words.txt, 한 줄에 하나)에 둠.
_PW = os.path.join(ROOT, "private_words.txt")
FORBID = [w.strip() for w in open(_PW, encoding="utf-8")] if os.path.exists(_PW) else []
FORBID = [w for w in FORBID if w]
YEAR = re.compile(r"(?:19|20)\d\d[.年]\s?\d")          # 2024.3 · 2020.5~2021.11 같은 서류의 연·월
YEAR_OK = ("2026-11", "2026-12")                       # 날짜표(시험 날짜)는 괜찮음


# 5판(11/28)부터 출처 메모에 본인 답을 그대로 옮겨 적음("답17: …" · "말11/26: …" · "답2에서 — …") → 표시 이름만 남기고 뒤의 말은 지움.
_LB = r"(?:답[\d/]+|말[\d/·]+|사실\d*|원서\d*|이력서\d*)"
QUOTE = re.compile(r'"(' + _LB + r"(?:\s?·\s?" + _LB + r')*)(?:에서)?\s?(?::| —)[^"\n]*"')


def scrub(text):
    text, n1 = _scrub_paren(text)
    text, n2 = QUOTE.subn(r'"\1"', text)
    return text, n1 + n2


def _scrub_paren(text):
    """출처 표시 뒤의 괄호 속을 지움(같은 줄 안에서, 따옴표를 넘지 않는 것만)."""
    out, i, n = [], 0, 0
    while True:
        m = LABEL.search(text, i)
        if not m:
            out.append(text[i:])
            break
        out.append(text[i:m.end() - 1])        # 표시 이름까지
        j, depth = m.end(), 1
        while j < len(text) and depth and text[j] not in '"\n':
            depth += (text[j] == "(") - (text[j] == ")")
            j += 1
        if depth == 0:
            i = j                               # 괄호 속을 버림
            n += 1
        else:
            out.append("(")                     # 짝이 안 맞으면 그대로 둠
            i = m.end()
    return "".join(out), n


def blank_src(o):
    if isinstance(o, dict):
        return {k: ("" if k == "src" else blank_src(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [blank_src(x) for x in o]
    return o


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    dest = os.path.abspath(sys.argv[1])
    assert os.path.isdir(os.path.join(dest, ".git")), "저장소 폴더가 아님: " + dest
    assert os.path.exists(os.path.join(SITE, "index.html")), "site/ 가 없음 — 먼저 빌드"
    data = open(os.path.join(SITE, "data.js"), encoding="utf-8").read()
    assert '"preview"' not in data, "미리 보기 판은 올리지 않음 — content_src.py --release 로 다시 빌드"
    # 1) 비우고(.git 만 남김) 사이트를 맨 위에
    for name in os.listdir(dest):
        if name == ".git":
            continue
        p = os.path.join(dest, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    for name in os.listdir(SITE):
        p = os.path.join(SITE, name)
        (shutil.copytree if os.path.isdir(p) else shutil.copy2)(p, os.path.join(dest, name))
    open(os.path.join(dest, ".nojekyll"), "w").close()
    # 2) 소스
    d = os.path.join(dest, "src")
    for sub in ("app", "content", "tools", "tests", "kvg"):
        os.makedirs(os.path.join(d, sub))
    for name in ("app.js", "index.html", "sw.js"):
        shutil.copy2(os.path.join(SRC, "app", name), os.path.join(d, "app", name))
    n_scrub = 0
    for name in CONTENT:
        src = os.path.join(SRC, "content", name)
        if name in SCRUB:
            text, n = scrub(open(src, encoding="utf-8").read())
            n_scrub += n
            open(os.path.join(d, "content", name), "w", encoding="utf-8").write(text)
        else:
            shutil.copy2(src, os.path.join(d, "content", name))
    for name in sorted(os.listdir(os.path.join(SRC, "tools"))):
        if name.endswith(".py"):
            shutil.copy2(os.path.join(SRC, "tools", name), os.path.join(d, "tools", name))
    shutil.copy2(os.path.join(SRC, "tests", "run.cjs"), os.path.join(d, "tests", "run.cjs"))
    for name in sorted(os.listdir(os.path.join(SRC, "kvg"))):
        shutil.copy2(os.path.join(SRC, "kvg", name), os.path.join(d, "kvg", name))
    ver = json.load(open(os.path.join(SITE, "version.json")))
    open(os.path.join(dest, "README.md"), "w", encoding="utf-8").write(README % ver)
    # 3) 검사 ① 올릴 소스(출처 괄호를 지운 것)만으로 내용을 다시 만들어, 원본과 같은지 봄(출처 칸만 빼고)
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    r = subprocess.run([sys.executable, os.path.join(d, "content", "content_src.py"), "--release"], capture_output=True, text=True, env=env)
    if r.returncode:
        raise SystemExit("올릴 소스로 내용을 만들지 못함:\n" + r.stdout[-800:] + r.stderr[-1500:])
    a = blank_src(json.load(open(os.path.join(d, "content", "content.json"), encoding="utf-8")))
    b = blank_src(json.load(open(os.path.join(SRC, "content", "content.json"), encoding="utf-8")))
    if a != b:
        diff = [k for k in b if a.get(k) != b[k]]
        raise SystemExit("올릴 소스로 만든 내용이 원본과 다름: " + ", ".join(diff))
    for name in ("content.json", "furi_pairs.tsv"):          # 만들어지는 파일은 저장소에 두지 않음(출처 메모가 다시 들어가지 않게)
        p = os.path.join(d, "content", name)
        if os.path.exists(p):
            os.remove(p)
    for base, dirs, _ in os.walk(d):
        for x in [x for x in dirs if x == "__pycache__"]:
            shutil.rmtree(os.path.join(base, x))
    # 검사 ② 넣으면 안 되는 말 · 서류의 연월
    bad = []
    for base, _, files in os.walk(dest):
        if ".git" in base.split(os.sep):
            continue
        for fn in files:
            if not fn.endswith((".py", ".js", ".cjs", ".html", ".json", ".md", ".tsv", ".txt")):
                continue
            p = os.path.join(base, fn)
            text = open(p, encoding="utf-8", errors="replace").read()
            rel = os.path.relpath(p, dest)
            for w in FORBID:
                if w in text:
                    bad.append("%s: 넣으면 안 되는 말 (목록 %d번째)" % (rel, FORBID.index(w) + 1))
            if rel.startswith("src" + os.sep + "content") and fn.endswith(".py"):
                for m in YEAR.finditer(text):
                    line = text[text.rfind("\n", 0, m.start()) + 1:text.find("\n", m.end())]
                    if not any(k in line for k in YEAR_OK):
                        bad.append("%s: 연월 '%s' — %s" % (rel, m.group(0), line.strip()[:70]))
    if bad:
        raise SystemExit("올리면 안 되는 내용이 있음:\n  " + "\n  ".join(bad[:40]))
    if not FORBID:
        print("  ※ private_words.txt 가 없어서 '넣으면 안 되는 말' 검사는 건너뜀")
    n_files = sum(len(f) for b_, _, f in os.walk(dest) if ".git" not in b_.split(os.sep))
    print("꾸림: %s · 판 %s · 파일 %d개 · 출처 괄호 %d곳 지움 · 검사 통과" % (dest, ver["ver"], n_files, n_scrub))


README = """# sakubun — 분카 작문·면접 드릴

문화복장학원 입학 시험(2026-12-12)의 작문과 면접에 쓸 문장을 외우는 사이트예요.

- 사이트: https://qslns.github.io/sakubun/ (저장소 맨 위의 파일이 그대로 사이트예요)
- 지금 판: %(ver)s (%(stamp)s)
- 음성: 마이크로소프트 Nanami(답) · Keita(질문)

## 폴더

- `index.html` `app.js` `data.js` `sw.js` `version.json` `audio/` — 만들어진 사이트(손으로 고치지 않음)
- `src/app` — 앱 원본 · `src/content` — 문장 원본(c3_*.py) · `src/tools` — 빌드 도구 · `src/tests` — 자동 시험 · `src/kvg` — 획순 그림

## 고치는 순서

1. `src/content/c3_*.py` 를 고침 (질문의 순서와 묶음은 `c3_q.py`)
2. `python3 src/content/content_src.py --release && python3 src/tools/build.py --strict-audio` → `site/`
3. 새 음성: `python3 src/tools/tts.py --prune` · 받아쓰기 검사: `python3 src/tools/asr_check.py`
4. `node src/tests/run.cjs site all` 을 전부 통과한 판만 올림
5. `python3 src/tools/publish_repo.py <저장소 폴더>` → commit → push

공개 저장소라서 이름·나이·다닌 학교 이름은 어디에도 넣지 않아요. 문장 원본의 출처 메모는 자세한 내용(서류의 내용 · 본인이 답한 말)을 지운 것이에요.

획순 그림(`src/kvg`, 사이트의 글자 쓰기 화면): KanjiVG (© Ulrich Apel, CC BY-SA 3.0, kanjivg.tagaini.net)
"""

if __name__ == "__main__":
    main()
