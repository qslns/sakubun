# -*- coding: utf-8 -*-
"""예상 질문을 '나올 확률이 높은 순서'의 묶음(이어지는 질문)으로 엮음.

5판(11/28)부터 묶음과 순서는 c3_q.py 가 바로 정함(L.CHAINS = [[등급, 묶음 이름, 근거, [질문 번호 …]] …]).
  "Q01"  = 질문 번호(묶음의 첫 것 = 큰 질문, 그다음 = 이어지는 질문)
  "=Q02" = 바로 앞 질문을 다르게 묻는 말(세지 않고, 질문 아래에 글로만 둠)

등급의 근거(조사 11/27 · review/research_1127.md)
  A 서울사무소가 직접 말한 것(지원한 학과 이유 · 제2지망이 가방과 상반되는데 왜 · 기본 일본어) + 후기 4곳 이상에 나온 것
  B 후기 1~3곳에 나온 것 · 원서에 쓴 말에서 바로 이어지는 것
  C 내 원서와 이력서에 적힌 것에서 나올 수 있는 것(후기: "서류를 보고 추가로 묻는다")
  D 일반적인 것, 상황 대처
"""

TIERS = [
    ("A", "거의 확실히 나오는 질문", "서울사무소가 말했거나, 후기 4곳 이상에 나온 것"),
    ("B", "자주 나오는 질문", "후기에 나왔거나, 원서에 쓴 말에서 이어지는 것"),
    ("C", "내 서류 때문에 나올 수 있는 질문", "원서와 이력서에 쓴 내용"),
    ("D", "가끔 나오는 질문 · 막혔을 때", "일반적인 것과 상황 대처"),
]

# 면접 모의에서 '큰 질문'으로 뽑지 않는 묶음(절차 · 상황 대처)
PROC = ("처음과 끝", "막혔을 때")


def apply(L):
    """L.QS(창고)를 등급·묶음 순서로 다시 엮고, L.QCATS · L.QCH 를 채움. 돌려주는 값 = 빠진 질문 수."""
    bank = {q["id"]: q for q in L.QS}
    out, chains, used, cnt = [], [], set(), {}
    for n, (tier, title, ev, toks) in enumerate(L.CHAINS, 1):
        key = "c%02d" % n
        main = prev = None
        ids = []
        for tok in toks:
            var, oid = tok.startswith("="), tok.lstrip("=")
            assert oid in bank, "c3_rank: 창고에 없는 번호 %s" % oid
            assert oid not in used, "c3_rank: 두 번 쓴 번호 %s" % oid
            used.add(oid)
            cnt[tier] = cnt.get(tier, 0) + 1
            d = dict(bank[oid])
            for k in ("par", "rel", "low"):
                d.pop(k, None)
            d.update(id="%s%02d" % (tier, cnt[tier]), cat=tier, ch=key, old=oid, core=False)
            if var:
                assert prev is not None, "c3_rank: 묶음의 첫 질문이 '=' 로 시작함 (%s)" % title
                d.update(rel="var", par=prev["id"])
                d["core"] = prev.get("core", False)
            elif main is None:
                main = prev = d
                d["core"] = tier == "A"
            else:
                d.update(rel="fu", par=main["id"])
                prev = d
            out.append(d)
            ids.append(d["id"])
        ch = dict(k=key, cat=tier, ko=title, ev=ev, main=main["id"], ids=ids)
        if title.startswith(PROC):
            ch["proc"] = 1
        chains.append(ch)
    dropped = len(L.QS) - len(out)
    L.QS[:] = out
    L.QCATS[:] = [[t, name] for t, name, _ in TIERS]
    L.QCH = chains
    L.QTIERS = [dict(k=t, ko=name, ev=e) for t, name, e in TIERS]
    return dropped


def unit_order(L, prefix="i"):
    """묶음 순서대로, 답으로 처음 쓰이는 면접 답 단위의 순서(외우는 순서를 나올 확률 순서에 맞춤)."""
    seen = []
    for q in L.QS:
        for a in q["a"]:
            if isinstance(a, str):
                uid = a.split(":")[0]
                if uid.startswith(prefix) and uid[len(prefix):].isdigit() and uid not in seen:
                    seen.append(uid)
    return seen
