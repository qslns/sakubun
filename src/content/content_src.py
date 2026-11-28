#!/usr/bin/env python3
"""문장 원본(5판, 11/28). python3 src/content/content_src.py  ->  src/content/content.json

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

# 과정 순서(5판): 블록 ①~⑧(11/30~12/4) → 면접 답(묶음 순서 = 나올 확률이 높은 것부터) → 주제와 면접 답을 번갈아.
B = ["b1", "b2", "b3", "b5", "b4", "b8", "b6", "b7"]
_I_USED = c3_rank.unit_order(L)
_I_ALL = [u["id"] for u in L.IV]
I = _I_USED + [u for u in _I_ALL if u not in _I_USED]
assert len(I) == len(_I_ALL) == 27 and len(set(I)) == 27
# 주제 순서: 지망 이유 → 실제로 나온 주제(장래 하고 싶은 일 2018 · 나의 패션관 2013~14) → 준비 안 한 주제용 틀(t16)
#            → 실제로 나온 주제(내 나라의 명소 2025년 11월) → 전해 들은 주제(배우고 싶은 것) → 보기로 든 주제(일본 문화 · 디자이너) → 한일 패션
T = ["t1", "t2", "t3", "t16", "t7", "t4", "t8", "t5", "t6"]
assert sorted(T) == sorted(t["id"] for t in L.TOPICS)
ORDER = B[:6] + I[:4] + B[6:] + I[4:8]
rest_i, rest_t = I[8:], T[:]
ORDER += ["e1"]
while rest_i or rest_t:
    if rest_t:
        ORDER.append(rest_t.pop(0))
    ORDER += rest_i[:2]
    rest_i = rest_i[2:]
    if len(rest_t) == 5 and "e2" not in ORDER:
        ORDER.append("e2")
if "e2" not in ORDER:
    ORDER.append("e2")

# 날짜표: 11/30~12/5 는 가볍게(블록과 면접 답 8개) · 12/6(JLPT 날)부터 출국 전까지는 이것만 · 새로 외우는 것은 12/9까지 · 12/10은 복습·모의만 · 12/11 없음(출국)
# 5판에서 단위가 71 → 46으로 줄어서, 12/6~12/10 하루 시간도 줄임.
DAYS = {
    "2026-11-30": {"min": 30, "b": 2, "w": 6, "rev": 10},
    "2026-12-01": {"min": 30, "b": 2, "w": 4, "rev": 10},
    "2026-12-02": {"min": 30, "b": 2, "w": 3, "rev": 10},
    "2026-12-03": {"min": 60, "b": 1, "i": 4, "w": 8, "rev": 20, "q": 10},
    "2026-12-04": {"min": 60, "b": 1, "i": 4, "w": 8, "rev": 20, "q": 10},
    "2026-12-05": {"min": 15, "only": "rev", "rev": 15},
    "2026-12-06": {"min": 120, "t": 2, "i": 5, "e": 1, "w": 13, "blocks": 1, "rev": 45, "q": 15},
    "2026-12-07": {"min": 240, "t": 3, "i": 6, "e": 1, "w": 14, "essay": 2, "mock": 2, "blocks": 1, "rev": 80, "q": 25},
    "2026-12-08": {"min": 270, "t": 2, "i": 5, "w": 13, "essay": 3, "mock": 2, "un": 1, "blocks": 1, "rev": 90, "q": 25},
    "2026-12-09": {"min": 270, "t": 2, "i": 3, "w": 13, "essay": 3, "mock": 3, "un": 2, "rev": 110, "q": 25, "full": 1},
    "2026-12-10": {"min": 270, "only": "rev", "essay": 4, "mock": 3, "un": 2, "full": 1, "rev": 140, "q": 25},
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
