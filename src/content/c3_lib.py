"""문장 원본(3판)에서 쓰는 도우미.

문장은 후리가나 없이 씀(src/tools/furi.py 가 붙임).  /  = 어순 조각 경계 · {정답|오답|오답|오답} = 빈칸.
src  = 출처(원서 몇 번 문장 · 사용자가 말한 날짜 · 공개 자료).
st   = "ok" 확정 가능 · "chk" 사용자 확인 필요(내가 채운 말이 들어감) · "pend" 처음 보낸 질문의 답을 기다리는 중.
"""
import copy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))
import furi  # noqa: E402

BLOCKS, TOPICS, IV, EM, QS, UNSEEN = [], [], [], [], [], []
BY = {}          # "b1.2" -> 문장
QCATS = [("A", "지망·동기"), ("B", "학력·경력"), ("C", "졸업 후"), ("D", "일본어·일본"), ("E", "생활·돈"),
         ("F", "패션 일반"), ("G", "사람됨"), ("H", "시험 날·그룹 면접")]
_sid = [0]


def S(ja, ko, src="", st="ok", **kw):
    _sid[0] += 1
    d = dict(ja=furi.annot(ja, kw.pop("sid", "s%d" % _sid[0])), ko=ko, src=src, st=st)
    d.update(kw)
    return d


def ref(key):
    """이미 쓴 문장을 그대로 다시 씀(예: ref("b3.1")). 외울 문장 수는 늘지 않음."""
    d = copy.deepcopy(BY[key])
    d["ref"] = key
    return d


def Q(ja, ko):
    return dict(ja=furi.plain_part(ja.replace(" ", "")), ko=ko)


def _reg(uid, sents, names=None):
    for i, s in enumerate(sents, 1):
        BY["%s.%s" % (uid, names[i - 1] if names else i)] = s


def block(no, ko, q, qko, s, roles=("결론", "장면", "그래서")):
    uid = "b%d" % no
    for x, r in zip(s, roles):
        x["role"] = r
    BLOCKS.append(dict(id=uid, no=no, ko=ko, say=2, q=Q(q, qko), s=s))
    _reg(uid, s)


def topic(no, ko, ja, body, first, last, extra=(), frame=False):
    uid = "t%d" % no
    TOPICS.append(dict(id=uid, no=no, ko=ko, ja=furi.plain_part(ja), body=list(body), first=first, last=last,
                       extra=list(extra), frame=frame))
    BY[uid + ".f"] = first
    BY[uid + ".l"] = last
    for i, x in enumerate(extra, 1):
        BY["%s.x%d" % (uid, i)] = x


def iv(no, ko, q, qko, s):
    uid = "i%d" % no
    IV.append(dict(id=uid, ko=ko, q=Q(q, qko), s=s))
    _reg(uid, s)


def em(when, ja, ko, src="틀", st="ok", **kw):
    d = S(ja, ko, src=src, st=st, when=when, nocloze=True, noorder=True)
    d.update(kw)
    return d


def emunit(no, ko, s):
    uid = "e%d" % no
    EM.append(dict(id=uid, ko=ko, s=s))
    _reg(uid, s)


def SA(ja, ko, src="", st="ok", **kw):
    """짧은 답(한 문장). 외우는 과정에는 안 들어가고 '예상 질문 전체'에서만 나옴."""
    d = dict(sa=1, ja=furi.plain_part(ja.replace(" ", "")), ko=ko, src=src, st=st)
    d.update(kw)
    return d


_qn = {}
_last_main = [None]


def q(cat, ja, ko, ans, src="", fu=False, hard=False, var=False, note="", core=False):
    """예상 질문. ans = "b1" | "b1:1,2" | "i5" | "t13:f" | SA(...) | 이것들의 목록.
    fu=True 꼬리 질문(바로 앞의 큰 질문에 붙음) · var=True 같은 것을 다르게 묻는 말 · hard=True 압박 질문 · core=True 서울사무소가 '기본으로 묻는다'고 한 질문(11/26)."""
    _qn[cat] = _qn.get(cat, 0) + 1
    qid = "%s%02d" % (cat, _qn[cat])
    d = dict(id=qid, cat=cat, ko=ko, src=src, hard=bool(hard), core=bool(core), note=note,
             a=ans if isinstance(ans, list) else [ans])
    d.update(Q(ja, ko))
    if fu or var:
        d["par"] = _last_main[0]
        d["rel"] = "fu" if fu else "var"
    else:
        _last_main[0] = qid
    QS.append(d)
    return qid


def X(ja, ko, st="ok"):
    """처음 보는 주제의 '주제에 답하는 문장'(모범). 외우는 문장이 아니라 보기용."""
    return dict(ja=furi.plain_part(ja.replace(" ", "")), ko=ko, st=st)


def unseen(ja, ko, same=None, xs=(), blocks=(), br=1, tip="", src=""):
    """처음 보는 주제.
    same="t14"  → 준비한 주제와 같은 글로 씀.
    그 밖        → 틀 첫 문장 + 주제에 답하는 문장(xs, 두세 개) + 연결 문장(br = 1 내 생각을 쓴 뒤 | 2 사실·일상을 쓴 뒤) + 블록 2개 + 끝 문장."""
    UNSEEN.append(dict(id="n%02d" % (len(UNSEEN) + 1), ja=furi.plain_part(ja), ko=ko, same=same, xs=list(xs),
                       body=list(blocks), br=int(br), tip=tip, src=src))
