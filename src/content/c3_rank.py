# -*- coding: utf-8 -*-
"""예상 질문을 '나올 확률이 높은 순서'의 묶음(이어지는 질문)으로 엮음.

사용자 말(11/26 16:48 · 16:54):
  "나오는 게 거기서 거기 … 실제로 나올 확률이 높은 순부터 나열하고, 나올 가능성 없는 거나 의미 없는 건 빼 줘."
  "질문 하나에 답 하나 하고 끝나는 경우는 거의 없으니까, 이어지고 이어지는 질문들에도 대비해야 해."
  "듣고 이해하는 건 거의 될 거야. 답만 잘하면 돼."  → 바꿔 묻는 말(≈)은 세지 않고, 질문 아래에 글로만 둠.

c3_q.py 는 질문 창고. 여기에 적힌 질문만, 여기 적힌 순서로 앱에 나감(안 적힌 것은 빠짐).
  "A01"  = 창고의 질문 번호(묶음의 첫 것 = 큰 질문, 그다음 = 이어지는 꼬리 질문)
  "=A02" = 바로 앞 질문을 다르게 묻는 말

등급의 근거
  A 서울사무소가 직접 말한 것(11/26: 지원한 학과 이유 · 제2지망이 가방과 관계없는데 왜 · 기본 일본어) + 후기마다 나오는 것
  B 합격자·수험생 후기에 나온 것(지후 · 대만 블로그 · 도쿄 갤럭시 · 야후 지에부쿠로 · mixi)
  C 내 원서와 이력서에 적힌 것에서 나올 수 있는 것(후기: "서류를 보고 추가로 묻는다")
  D 일반적인 것, 상황 대처
"""
import hashlib
import re

TIERS = [
    ("A", "거의 확실히 나오는 질문", "서울사무소가 말했거나, 후기마다 나오는 것"),
    ("B", "자주 나오는 질문", "합격자 후기에 나온 것"),
    ("C", "내 서류 때문에 나올 수 있는 질문", "원서와 이력서에 쓴 내용"),
    ("D", "가끔 나오는 질문 · 막혔을 때", "일반적인 것과 상황 대처"),
]

# (등급, 묶음 이름, 근거, 질문들)
CHAINS = [
    ("A", "처음과 끝 (들어가서 나올 때까지)", "면접 절차 · 반드시 있음",
     "H14 =H15 H16 H17 B01 =B02 =B03 H11 H12 =H13 H20"),
    ("A", "왜 가방인가 (이 학과를 고른 이유)", "서울사무소 · 후기 전부",
     "A01 =A02 =A03 A04 B33 B34 A22 A25 A23"),
    ("A", "제2지망은 왜 텍스타일과인가", "서울사무소(가방과 관계가 없는데 왜 골랐는지 묻는다)",
     "A55 =A56 N01 N03 A57 N02 A59 A60 A58"),
    ("A", "왜 이 학교 · 왜 일본", "후기 전부",
     "A30 =A31 =A32 A35 A38 A27 =A28 =A29 A33"),
    ("A", "일본어 공부", "서울사무소(기본 일본어 능력) · 후기(공부 방법)",
     "D01 =D02 D03 D04 D05 D06 D07 D09 D10"),
    ("A", "가방을 만든 적이 없는데", "원서에 '아직 만들어 본 적이 없다'고 썼음 · 지원 이유에 이어서",
     "A06 A09 A11 A07 A12 A13 A16 =A17"),
    ("A", "오늘 입은 옷 · 옷을 고르는 기준", "후기 3곳(지후 · 대만 · 야후)",
     "F07 F08 N07"),
    ("A", "좋아하는 브랜드 · 디자이너", "후기(야후) · 원서에 썼음",
     "F05 A45 A40 =G13 A41 A42 A43 A44"),

    ("B", "대학 전공 · 진로를 바꾼 이유", "후기(대만 · mixi: 전 대학과 패션의 관계)",
     "B09 B08 B23 =B24 B10 B11"),
    ("B", "가족의 찬성 · 학비", "후기(대만: 가족이 찬성하는지 · 지후: 학비가 비싼데)",
     "E09 =E10 E11 E01 =E02 N06 E08"),
    ("B", "힘들어도 끝까지 다닐 수 있나", "후기(지후 · 야후 2건: 과제가 많다, 체력)",
     "B50 B51 E19 B49 B53"),
    ("B", "취미 · 쉬는 날", "후기(대만: 답하면 이어서 자세히 물음 · 야후 · mixi)",
     "G08 G09 G10 G11"),
    ("B", "졸업 후 · 장래의 꿈", "후기(야후) · 작문에도 나온 주제(대만)",
     "C01 =C02 =C03 =C15 C07 C16 C04 C05 C06 C08 C13 C14"),
    ("B", "패션이란 · 일본 패션", "후기(지후: 당신에게 패션이란) · 작문에도 나온 주제",
     "F01 =F02 =H23 F04 F03 F06 A47 A51"),
    ("B", "장점 · 단점 · 특기", "후기(야후: 장단점 · 특기)",
     "G01 =G02 N05 N04 G03 G04 =G05 G06"),
    ("B", "입학하면 배우고 싶은 것", "지원 이유에 이어서",
     "A54 A52 A53"),

    ("C", "패션 학교에서 배운 것 · 졸업 작품", "원서(졸업 작품을 썼음) · 이력서",
     "B27 B28 B29 B37 B35 B38 B39"),
    ("C", "졸업하고 지금까지", "이력서(졸업 뒤 1년)",
     "B44 B45 B46"),
    ("C", "백화점 · 군대", "이력서(직장 · 병역)",
     "B18 B19 B21 B14 B15"),
    ("C", "고등학교를 옮긴 이유", "이력서(고등학교 3곳)",
     "B04 B05"),
    ("C", "나이", "이력서",
     "B47 =B48"),

    ("D", "일본 생활 (살 곳 · 혼자 살기 · 아르바이트)", "유학생에게 흔한 질문",
     "E12 E14 =E15 E16 E17 E18 D19"),
    ("D", "일본에 와 본 적 · 일본의 좋은 점", "유학생에게 흔한 질문",
     "D12 D13 B41 D15 D17"),
    ("D", "시험 날 이야기", "면접 첫머리의 가벼운 말",
     "H01 H02 H03 H04 H05 H06"),
    ("D", "그룹 면접 · 막혔을 때", "상황 대처(3명이 같이 봄)",
     "H08 H19 H24 H25 H21"),
]

# 면접 모의에서 '큰 질문'으로 뽑지 않는 묶음(절차 · 가벼운 말 · 상황 대처)
PROC = ("처음과 끝", "시험 날 이야기", "그룹 면접")

# 창고(c3_q.py)의 (번호 · 질문) 지문. 창고에서 질문을 더하거나 빼서 번호가 밀리면 위의 번호가 어긋나므로, 빌드를 멈추고 알려 줌.
BANK_SIG = "90545baeb2"

_plain = lambda s: re.sub(r"\[([^|\]]+)\|[^\]]+\]", r"\1", s)


def bank_sig(qs):
    return hashlib.md5("|".join("%s:%s" % (q["id"], _plain(q["ja"])) for q in qs).encode("utf-8")).hexdigest()[:10]


def apply(L):
    """L.QS(창고)를 등급·묶음 순서로 다시 엮고, L.QCATS · L.QCH 를 채움. 돌려주는 값 = 빠진 질문 수."""
    sig = bank_sig(L.QS)
    if BANK_SIG != sig:
        raise SystemExit("c3_rank: 질문 창고가 바뀌었음(지문 %s). 위 CHAINS 의 번호가 맞는지 보고 BANK_SIG 를 이 값으로 고칠 것." % sig)
    bank = {q["id"]: q for q in L.QS}
    out, chains, used, cnt = [], [], set(), {}
    for n, (tier, title, ev, spec) in enumerate(CHAINS, 1):
        key = "c%02d" % n
        main = prev = None
        ids = []
        for tok in spec.split():
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
