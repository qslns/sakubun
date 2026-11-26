#!/usr/bin/env python3
"""문장 원본(3판). python3 src/content/content_src.py  ->  src/content/content.json

내용은 c3_essay.py(블록·주제·틀) · c3_iv.py(면접 답·인사) · c3_q.py(예상 질문 전체)에 있음.
기준: claude/분카_작문면접_드릴_지시서_추가_1126.md + claude/분카_원서_기입내용.md 0~2절.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import c3_lib as L          # noqa: E402
import c3_essay, c3_iv, c3_q  # noqa: E402,F401
import c3_rank              # noqa: E402
from c3_words import WORDS  # noqa: E402

# 예상 질문: 창고(c3_q.py)에서 '나올 확률이 높은 순서'의 묶음으로 골라 다시 엮음(11/26 16:54). 안 나올 질문은 여기서 빠짐.
Q_BANK = len(L.QS)
Q_DROPPED = c3_rank.apply(L)

# 과정 순서: 블록 ①~⑧(11/30~12/4) → 면접 답 → 주제와 면접 답을 번갈아.
# 면접 답은 서울사무소가 말한 순서로(11/26): 왜 이 학과 → 제2지망(텍스타일)은 왜 → 기본 질문 → 서류에서 나오는 질문 → 그 밖.
B = ["b1", "b2", "b3", "b5", "b4", "b8", "b6", "b7"]
# 면접 답을 외우는 순서 = 질문 묶음의 순서(나올 확률이 높은 것부터). 어느 질문에도 안 쓰이는 답은 맨 뒤.
_I_USED = c3_rank.unit_order(L)
I = _I_USED + ["i%d" % n for n in range(1, 46) if "i%d" % n not in _I_USED]
assert len(I) == 45 and len(set(I)) == 45
# 주제 순서: 후기에 실제로 나온 것(졸업 후 하고 싶은 일 · 나의 패션관)과 지망 이유 먼저 → 계열 대학 공개 기출(한일 차이·매력·디자이너·환경·AI) → 그 밖
# t16 = 만능 작문(어떤 주제가 나와도 쓰는 글). 후기에 나온 세 주제 바로 다음에 외움(11/26 16:54).
T = ["t1", "t2", "t3", "t16", "t13", "t7", "t6", "t5", "t4", "t11", "t15", "t9", "t8", "t14", "t10", "t12"]
ORDER = B[:6] + I[:4] + B[6:] + I[4:8]
rest_i, rest_t = I[8:], T[:]
ORDER += ["e1"]
while rest_i or rest_t:
    if rest_t:
        ORDER.append(rest_t.pop(0))
    ORDER += rest_i[:2]
    rest_i = rest_i[2:]
    if len(rest_t) == 8 and "e2" not in ORDER:
        ORDER.append("e2")
if "e2" not in ORDER:
    ORDER.append("e2")

# 날짜표(추가 지시서 5-5절): 11/30~12/5 하루 시간은 2판 그대로 · 늘어난 분량은 12/3 이후와 12/6~12/10 · 새로 외우는 것은 12/9까지 · 12/10은 복습·모의만 · 12/11 없음
DAYS = {
    "2026-11-30": {"min": 30, "b": 2, "w": 6, "rev": 10},
    "2026-12-01": {"min": 30, "b": 2, "w": 4, "rev": 10},
    "2026-12-02": {"min": 30, "b": 2, "w": 3, "rev": 10},
    "2026-12-03": {"min": 60, "b": 1, "i": 4, "w": 8, "rev": 20, "q": 10},
    "2026-12-04": {"min": 60, "b": 1, "i": 4, "w": 8, "rev": 20, "q": 10},
    "2026-12-05": {"min": 15, "only": "rev", "rev": 15},
    "2026-12-06": {"min": 150, "t": 4, "i": 8, "e": 1, "w": 12, "blocks": 1, "rev": 60, "q": 20},
    "2026-12-07": {"min": 330, "t": 5, "i": 11, "e": 1, "w": 13, "essay": 3, "mock": 2, "blocks": 1, "rev": 100, "q": 30},
    "2026-12-08": {"min": 375, "t": 5, "i": 10, "w": 13, "essay": 4, "mock": 2, "un": 2, "blocks": 1, "rev": 110, "q": 30},
    "2026-12-09": {"min": 375, "t": 2, "i": 8, "w": 13, "essay": 4, "mock": 3, "un": 3, "rev": 150, "q": 30, "full": 1},
    "2026-12-10": {"min": 345, "only": "rev", "essay": 5, "mock": 3, "un": 3, "full": 1, "rev": 180, "q": 30},
}
REST = {"2026-12-11": "출국"}


def main():
    preview = "--release" not in sys.argv
    C = {
        "exam": "2026-12-12", "start": "2026-11-30", "days": DAYS, "rest": REST,
        "blocks": L.BLOCKS, "topics": L.TOPICS, "iv": L.IV, "em": L.EM,
        "qs": L.QS, "qcats": L.QCATS, "qch": L.QCH, "qtiers": L.QTIERS, "unseen": L.UNSEEN,
        "words": {k: {"w": v[0], "r": v[1], "ko": v[2]} for k, v in WORDS.items()},
        "order": ORDER,
        "notes": ({"preview": 1, "banner": "미리 보기 판이에요. '확인 필요'가 붙은 문장은 바뀔 수 있어요."} if preview else {}),
    }
    json.dump(C, open(os.path.join(HERE, "content.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, "furi_pairs.tsv"), "w", encoding="utf-8").write(L.furi.dump_pairs())
    n_ref = sum(1 for u in L.IV for s in u["s"] if s.get("ref"))
    n_var = sum(1 for q in L.QS if q.get("rel") == "var")
    print("content.json: 블록 %d · 주제 %d · 면접 %d(다시 쓰는 문장 %d) · 인사 %d · 질문 묶음 %d · 질문 %d(+바꿔 묻는 말 %d · 창고 %d에서 %d개 뺌) · 처음 보는 주제 %d" % (
        len(L.BLOCKS), len(L.TOPICS), len(L.IV), n_ref, len(L.EM), len(L.QCH), len(L.QS) - n_var, n_var, Q_BANK, Q_DROPPED, len(L.UNSEEN)))
    unused = [u for u in I if u not in _I_USED]
    if unused:
        print("  · 어느 질문에도 안 쓰이는 면접 답: %s" % " ".join(unused))


if __name__ == "__main__":
    main()
