#!/usr/bin/env python3
"""프로젝트 문서용 요약판(5판): 무엇이 나오나(조사) → 예상 질문(나올 확률이 높은 순서 · 묶음) → 만능 작문 → 작문 주제 → 문장.
읽기(히라가나)·문장별 출처는 뺌(전체 판은 review/문장.md 와 사이트).
  python3 src/tools/export_doc.py  →  review/문장_요약.md"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
C = json.load(open(os.path.join(ROOT, "src", "content", "content.json"), encoding="utf-8"))
ST = json.load(open(os.path.join(ROOT, "src", "content", "stats.json"), encoding="utf-8"))
CIRC = "①②③④⑤⑥⑦⑧"


def plain(s):
    s = re.sub(r"\[([^|\]]+)\|[^\]]+\]", r"\1", s)
    s = re.sub(r"\{([^|}]+)\|[^}]*\}", r"\1", s)
    return s.replace("/", "")


def mark(s):
    return ("★" if s.get("o") else "") + ("〔내 답〕" if s.get("st") == "chk" else "")


def line(sid, s):
    if s.get("ref"):
        return "- %s = %s 와 같은 문장" % (sid, s["ref"])
    return "- %s%s %s — %s" % (sid, (" " + mark(s)) if mark(s) else "", plain(s["ja"]), s["ko"])


def ans_text(q):
    out = []
    for a in q["a"]:
        if isinstance(a, dict):
            out.append("「%s」%s" % (plain(a["ja"]), "〔내 답〕" if a.get("st") == "chk" else ""))
        else:
            out.append(a.replace(":", "."))
    return " + ".join(out)


L = []
tst = {t["id"]: t for t in ST.get("topics", [])}
T = {t["id"]: t for t in C["topics"]}
B = {b["id"]: b for b in C["blocks"]}
QI = {q["id"]: q for q in C["qs"]}
n_q = sum(1 for q in C["qs"] if q.get("rel") != "var")
n_var = len(C["qs"]) - n_q
t_order = [u for u in C["order"] if u.startswith("t")]
uni = [t for t in C["topics"] if t.get("frame")][0]

n_topic = sum(1 for t in C["topics"] if not t.get("frame"))
L.append("# 분카 작문·면접 — 예상 질문(확률순)과 문장 (5판)\n")
L.append("갱신 2026-11-28 · 사이트 판 %s · 만든 곳: 작문·면접 드릴 세션 · 기준: 본인 답(11/27 1차 · 11/28 2차) + `claude/분카_원서_기입내용.md` 0~2절 · 진행 상황은 `claude/분카_작문면접_드릴_현황.md`\n" % json.load(open(os.path.join(ROOT, "site", "version.json")))["ver"])
L.append("- 5판에서 바뀐 것(본인 말 11/27 · 11/28): Claude가 지어낸 답을 전부 지우고, 본인이 답한 말만 일본어로 옮김 · \"통과할 정도로만, 간단해서 외우기 좋게\" → 면접 답 45 → %d개 · 작문 주제 15 → %d개 · 질문 231 → %d개로 줄임." % (len(C["iv"]), n_topic, n_q))
L.append("- 표시: ★ = 원서·이력서에 쓴 문장 그대로 · 〔내 답〕 = 본인이 답한 말을 일본어로 옮긴 문장(사이트의 '뜻 확인' 화면에서 내 말과 같은지 한 번 봄) · 표시 없음 = 전에 확인한 사실이나 정해진 말.")
L.append("- 규칙: です・ます · N3 문형까지 · 한 문장 40자 안쪽 · 본인 말만(Claude가 내용을 지어내지 않음) · 공개 사이트라 이름·나이·다닌 학교 실명·금액은 넣지 않음(〇〇 = 본인이 채울 자리).")
L.append("- 숫자: 외울 문장 %d개(내 답에서 옮긴 것 %d) · 질문 묶음 %d개 · 질문 %d개(+ 바꿔 묻는 말 %d) · 작문 주제 %d개 + 만능 작문 · 처음 보는 주제 %d개 · 손으로 쓸 낱말 %d개.\n" % (
    ST["sents_unique"], ST["sents_chk"], len(C["qch"]), n_q, n_var, n_topic, len(C["unseen"]), ST["words"]))

L.append("## 1. 무엇이 나오나 (조사한 것 · 11/27 한국어·일본어·중국어·영어 후기)\n")
L.append("- **서울사무소(본인이 직접 들음, 11/26 · 11/28)**: 면접·작문 둘 다 N2보다 쉬움. 면접은 ① 지원한 학과를 왜 골랐는지 ② 제2지망(텍스타일)을 왜 골랐는지 — 1지망과 상반되는 과라 거의 물어볼 것 ③ 기본 일본어.")
L.append("- **면접 형식(2기 도쿄, 후기)**: 유학생 3명 + 면접관 2명, 합쳐 15~20분. 원서를 보고 그 자리에서 물음.")
L.append("- **후기에 나온 면접 질문(나온 곳 수)**: 지망 이유(7곳 이상) → 오늘 입은 옷(5) → 일본에 온 적 · 가장 기억에 남는 곳 · 일본 영화·드라마(4) → 이력서에서: 아르바이트·일 경험과 꼬리 질문 · 전공·진로를 바꾼 이유 · 가족의 지지(3) → 졸업 후 / 학비·각오 / 패션관 · 한일 패션의 차이 · 존경하는 사람(각 3) → 자기소개 · 일본어 공부 · 마지막 한마디(각 2) → 취미(1).")
L.append("- **작문**: 필기와 합쳐 70분(청해 없음), 400자 정도. 실제로 나온 주제 = 「あなたの国の名所を教えてください」(2025년 11월) · 장래 하고 싶은 일(2018년 12월) · 나의 패션관(2013~14). 전해 들은 것 = 입학하면 무엇을 배울 것인가 · 졸업하면 무엇이 될 것인가. 보기로 든 것 = 좋아하는 일본 문화 · 디자이너 · 어릴 때의 추억.")
L.append("- 준비하지 못한 것: '어릴 때의 추억'은 본인 답이 없어서 문장을 만들지 않음(나오면 만능 작문의 틀로 씀).")
L.append("- 자세한 근거와 출처: 작업 폴더 `review/research_1127.md` (요약은 현황 문서).\n")

L.append("## 2. 예상 질문 — 나올 확률이 높은 순서 (묶음 %d개 · 질문 %d개)\n" % (len(C["qch"]), n_q))
L.append("묶음 하나 = 큰 질문(●) + 거기서 이어지는 꼬리 질문(↳). ≈ 는 바로 위 질문을 다르게 묻는 말(세지 않음). ! = 압박 질문. 답의 b·t·i·e 번호는 아래 문장 번호, 「 」는 그 질문에만 쓰는 짧은 답.\n")
tiers = {t["k"]: t for t in C.get("qtiers", [])}
cur = None
for n, ch in enumerate(C["qch"], 1):
    if ch["cat"] != cur:
        cur = ch["cat"]
        L.append("### %s. %s — %s\n" % (cur, tiers[cur]["ko"], tiers[cur]["ev"]))
    L.append("**%d. %s** — 근거: %s" % (n, ch["ko"], ch["ev"]))
    for qid in ch["ids"]:
        q = QI[qid]
        m = {"fu": "↳", "var": "　≈"}.get(q.get("rel"), "●")
        L.append("- %s %s%s (%s) → %s" % (m, plain(q["ja"]), " !" if q.get("hard") else "", q["ko"], ans_text(q)))
    L.append("")

paras = [plain(uni["first"]["ja"]), "".join(plain(s["ja"]) for b in uni["body"] for s in B[b]["s"]), plain(uni["last"]["ja"])]
L.append("## 3. 만능 작문 — 준비한 주제가 안 나왔을 때 (%d자 · 원고지 %d줄)\n" % (sum(len(p) for p in paras), sum(-(-(len(p) + 1) // 20) for p in paras)))
L.append("- 아무것도 못 짓겠으면 이대로: 첫 문장 → 블록 %s → 끝 문장." % " → ".join(CIRC[int(b[1:]) - 1] for b in uni["body"]))
L.append("- 첫 문장의 「このテーマ」 자리에는 시험지에 적힌 주제를 그대로 옮겨 써도 됨.")
L.append("- 명소·추억처럼 패션과 먼 주제에는 이 글이 잘 맞지 않음: 그럴 때는 첫 문장 뒤에 주제에 답하는 문장을 두세 개 직접 쓰고, 연결 문장 ②로 넘어감.")
L.append("- 주제에 답하는 문장을 한두 개 지을 수 있으면: 첫 문장 → 내가 지은 문장 → 연결 문장(내 생각을 썼으면 ①, 사실·일상을 썼으면 ②) → 블록 2개 → 끝 문장.\n")
for p in paras:
    L.append("> 　" + p)
    L.append(">")
L.pop()
L.append("")
L.append("틀 문장:")
for s in [uni["first"]] + uni.get("extra", []) + [uni["last"]]:
    L.append(line("틀·" + s.get("fr", ""), s))
L.append("")

L.append("## 4. 작문 주제 %d개 (외우는 순서)\n" % n_topic)
L.append("지망 이유 → 실제로 나온 주제(장래 하고 싶은 일 · 나의 패션관 · 내 나라의 명소) → 전해 들은 주제(배우고 싶은 것) → 보기로 든 주제(일본 문화 · 디자이너) → 한일 패션.\n")
for tid in t_order:
    t = T[tid]
    if t.get("frame"):
        continue
    body = " → ".join(("블록 " + CIRC[int(x[1:]) - 1]) if x[0] == "b" else "전용 " + x[1:] for x in t["body"])
    L.append("**주제 %d %s** (%s) — 첫 문장 → %s → 끝 문장 · %d자" % (t["no"], t["ko"], plain(t["ja"]), body, tst[t["id"]]["n"]))
    L.append(line("첫", t["first"]))
    for i, s in enumerate(t.get("extra", []), 1):
        L.append(line("전용 %d" % i, s))
    L.append(line("끝", t["last"]))
    L.append("")

L.append("## 5. 블록 8개 (각 3문장 · 작문과 면접에 같이 씀)\n")
for b in C["blocks"]:
    L.append("**블록 %s %s** — 질문: %s" % (CIRC[b["no"] - 1], b["ko"], plain(b["q"]["ja"])))
    for i, s in enumerate(b["s"], 1):
        L.append(line("%s.%d" % (b["id"], i), s))
    L.append("")

L.append("## 6. 처음 보는 주제 %d개 (준비한 글과 같은 글 %d · 만능 작문으로 %d)\n" % (len(C["unseen"]), sum(1 for t in C["unseen"] if t.get("same")), sum(1 for t in C["unseen"] if not t.get("same"))))
for t in C["unseen"]:
    if t.get("same"):
        L.append("- 「%s」 %s → 주제 %s과 같은 글" % (plain(t["ja"]), t["ko"], t["same"][1:]))
    else:
        L.append("- 「%s」 %s → 연결 %s · 블록 %s · 답하는 문장 보기: %s" % (
            plain(t["ja"]), t["ko"], "①②"[t.get("br", 1) - 1], "".join(CIRC[int(b[1:]) - 1] for b in t["body"]),
            " ".join(plain(x["ja"]) + ("〔내 답〕" if x.get("st") == "chk" else "") for x in t["xs"])))
L.append("")

iv = {it["id"]: it for it in C["iv"]}
i_order = [u for u in C["order"] if u in iv]
L.append("## 7. 면접 답 %d개 (외우는 순서 = 질문 묶음의 순서) + 인사·시험 날에 쓰는 말\n" % len(iv))
for uid in i_order:
    it = iv[uid]
    L.append("**%s %s** — 질문: %s" % (it["id"], it["ko"], plain(it["q"]["ja"])))
    for i, s in enumerate(it["s"], 1):
        L.append(line("%s.%d" % (it["id"], i), s))
for it in C["em"]:
    L.append("")
    L.append("**%s %s**" % (it["id"], it["ko"]))
    for i, s in enumerate(it["s"], 1):
        L.append("- %s.%d %s — %s" % (it["id"], i, plain(s["ja"]), s["ko"]))
L.append("")

L.append("## 8. 손으로 쓸 낱말 %d개\n" % ST["words"])
_seen, _ws = set(), []
for w in C["words"].values():
    if w["w"] not in _seen:
        _seen.add(w["w"])
        _ws.append("%s(%s)" % (w["w"], w["ko"]))
L.append(" · ".join(_ws))
L.append("")
out = os.path.join(ROOT, "review", "문장_요약.md")
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(out, len("\n".join(L)), "자")
