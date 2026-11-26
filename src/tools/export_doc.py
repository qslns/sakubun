#!/usr/bin/env python3
"""프로젝트 문서용 요약판(4판): 무엇이 나오나(조사) → 예상 질문(나올 확률이 높은 순서 · 묶음) → 만능 작문 → 작문 주제 → 문장.
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
    return ("★" if s.get("o") else "") + ("〔확〕" if s.get("st") == "chk" else "")


def line(sid, s):
    if s.get("ref"):
        return "- %s = %s 와 같은 문장" % (sid, s["ref"])
    return "- %s%s %s — %s" % (sid, (" " + mark(s)) if mark(s) else "", plain(s["ja"]), s["ko"])


def ans_text(q):
    out = []
    for a in q["a"]:
        if isinstance(a, dict):
            out.append("「%s」%s" % (plain(a["ja"]), "〔확〕" if a.get("st") == "chk" else ""))
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

L.append("# 분카 작문·면접 — 예상 질문(확률순)과 문장 (4판)\n")
L.append("갱신 2026-11-26 · 만든 곳: 작문·면접 드릴 세션 · 기준: `claude/분카_작문면접_드릴_지시서_추가_1126.md` + `claude/분카_원서_기입내용.md` 0~2절 + 본인 말(11/26) · 진행 상황은 `claude/분카_작문면접_드릴_현황.md`\n")
L.append("- 4판에서 바뀐 것(본인 말 11/26): 실제로 나올 확률이 높은 순서로 다시 엮음 · 안 나올 질문과 주제는 뺌 · 질문마다 이어지는 꼬리 질문을 묶음으로 · 제2지망 답을 다시 씀 · 만능 작문을 넣음.")
L.append("- 표시: ★ = 원서·이력서에 쓴 문장 그대로 · 〔확〕 = Claude가 채운 말이 들어가서 본인 확인이 필요(사이트의 '사실 확인' 화면에서 확인) · 표시 없음 = 원서나 본인 말에서 온 문장.")
L.append("- 규칙: です・ます · N3 문형까지 · 한 문장 40자 안쪽 · 본인 사실만 · 공개 사이트라 이름·나이·다닌 학교 실명·금액은 넣지 않음(〇〇 = 본인이 채울 자리).")
L.append("- 숫자: 외울 문장 %d개(확인 필요 %d) · 질문 묶음 %d개 · 질문 %d개(+ 바꿔 묻는 말 %d) · 작문 주제 15개 + 만능 작문 · 처음 보는 주제 %d개 · 손으로 쓸 낱말 %d개.\n" % (
    ST["sents_unique"], ST["sents_chk"], len(C["qch"]), n_q, n_var, len(C["unseen"]), ST["words"]))

L.append("## 1. 무엇이 나오나 (조사한 것)\n")
L.append("- **서울사무소(11/26, 본인이 직접 들음)**: 면접·작문 둘 다 N2보다 쉬움. 면접은 ① 지원한 학과를 왜 골랐는지 ② 제2지망(텍스타일)이 가방과 관계가 없는데 왜 골랐는지 ③ 기본 일본어 능력. 준비만 잘하면 거의 합격.")
L.append("- **후기에 실제로 나온 면접 질문**: 왜 이 학교·이 학과(전부) / 오늘 입은 옷, 옷을 고를 때 신경 쓰는 것(지후 · 대만 블로그 · 야후 지에부쿠로) / 대학 전공, 진로를 바꾼 이유, 가족이 찬성하는지(대만 · mixi) / 학교가 힘들고 학비가 비싼데 계속할 수 있는지, 체력(지후 · 야후) / 취미·쉬는 날 — 답하면 이어서 더 물음(대만) / 일본어를 어떻게 공부하는지(대만) / 당신에게 패션이란(지후) / 장점·단점, 특기, 좋아하는 브랜드, 장래의 꿈(야후) / 지금 가장 흥미 있는 것(mixi) / 서류를 보고 추가 질문(대만).")
L.append("- **면접 형식(후기)**: 유학생 3명이 같이 들어감 · 면접관 2명 · 15~30분 · 같은 질문을 차례로 답함.")
L.append("- **후기에 실제로 나온 작문 주제**: 「将来したい仕事」(졸업 후 하고 싶은 일, 대만 2018) · 「自分のファッション観」(나의 패션관, 지후). 같은 학원 계열 대학의 공개 기출: 일본과 자기 나라 패션의 차이 · 일본 패션의 매력 · 일본 디자이너 · 패션과 환경 · 생성 AI와 디자인.")
L.append("- 그래서: 질문은 아래 순서(A → D)로, 작문은 지망 이유 · 졸업 후 · 패션관 세 개와 만능 작문을 먼저.\n")

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

L.append("## 4. 작문 주제 15개 (외우는 순서 = 나올 확률이 높은 순서)\n")
L.append("후기에 실제로 나온 것: 지망 이유 · 졸업 후 하고 싶은 일 · 나의 패션관 → 계열 대학 공개 기출: 한일 차이 · 일본 패션의 매력 · 디자이너 · 환경 · AI → 그 밖의 기본 주제.\n")
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
            " ".join(plain(x["ja"]) + ("〔확〕" if x.get("st") == "chk" else "") for x in t["xs"])))
L.append("")

iv = {it["id"]: it for it in C["iv"]}
i_order = [u for u in C["order"] if u in iv]
L.append("## 7. 면접 답 %d개 (외우는 순서 = 질문 묶음의 순서) + 인사·그룹 면접에서 쓰는 말\n" % len(iv))
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
