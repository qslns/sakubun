#!/usr/bin/env python3
"""후리가나 자동 붙이기.

입력: 한자·가타카나를 그대로 쓴 문장(어순 경계 / 와 빈칸 {정답|오답|오답|오답} 표기는 그대로 둠).
출력: 빌드가 읽는 표기 — [漢字|かんじ] 가 전부 붙은 문장.

읽기는 OpenJTalk 사전에서 가져오고, FORCE(강제 읽기)와 JOIN(한 덩어리로 묶을 낱말)으로 고쳐요.
손으로 [표기|읽기]를 직접 쓴 곳은 그대로 둬요.
붙인 읽기는 PAIRS 에 모아 두고, 사람이 한 번 훑어볼 수 있게 dump_pairs()로 뽑아요.
"""
import re, unicodedata, warnings
warnings.filterwarnings("ignore")
import pyopenjtalk

KANJI = r"一-鿿々〆ヶ"
KATA = r"ァ-ヺー"
RE_KANJI = re.compile("[%s]" % KANJI)
RE_KATA = re.compile("[ァ-ヺ]")
RE_RUN = re.compile("([%s]+|[ァ-ヺ][%s]*|[A-Za-zＡ-Ｚａ-ｚ0-9０-９]+)" % (KANJI, KATA))
MANUAL = re.compile(r"\[([^\[\]|]+)\|([^\[\]|]+)\]")

# 강제 읽기: (정규식, [(표기, 읽기) ...]) — 표기를 이어 붙이면 정규식에 맞는 글자열과 같아야 함. 읽기가 "" 면 후리가나 없음.
FORCE = [
    (r"COMOLI", [("COMOLI", "こもり")]),
    (r"小森啓二郎", [("小森", "こもり"), ("啓二郎", "けいじろう")]),
    (r"N2", [("N2", "えぬに")]),
    (r"JPT", [("JPT", "じぇーぴーてぃー")]),
    (r"AI", [("AI", "えーあい")]),
    (r"IT", [("IT", "あいてぃー")]),
    (r"SNS", [("SNS", "えすえぬえす")]),
    (r"一から", [("一", "いち"), ("から", "")]),
    (r"学べば", [("学", "まな"), ("べば", "")]),
    (r"少しずつ", [("少", "すこ"), ("しずつ", "")]),
    (r"一つ", [("一", "ひと"), ("つ", "")]),
    (r"二つ", [("二", "ふた"), ("つ", "")]),
    (r"三つ", [("三", "みっ"), ("つ", "")]),
    (r"一人", [("一人", "ひとり")]),
    (r"二人", [("二人", "ふたり")]),
    (r"今日", [("今日", "きょう")]),
    (r"今年", [("今年", "ことし")]),
    (r"去年", [("去年", "きょねん")]),
    (r"来年", [("来年", "らいねん")]),
    (r"今月", [("今月", "こんげつ")]),
    (r"今回", [("今回", "こんかい")]),
    (r"日本語", [("日本語", "にほんご")]),
    (r"日本", [("日本", "にほん")]),
    (r"私", [("私", "わたし")]),
    (r"何回", [("何回", "なんかい")]),
    (r"何年", [("何年", "なんねん")]),
    (r"何を", [("何", "なに"), ("を", "")]),
    (r"何が", [("何", "なに"), ("が", "")]),
    (r"何か", [("何", "なに"), ("か", "")]),
    (r"何も", [("何", "なに"), ("も", "")]),
    (r"何で", [("何", "なに"), ("で", "")]),
    (r"何と", [("何", "なん"), ("と", "")]),
    (r"何だ", [("何", "なん"), ("だ", "")]),
    (r"何です", [("何", "なん"), ("です", "")]),
    (r"作り方", [("作", "つく"), ("り", ""), ("方", "かた")]),
    (r"使い方", [("使", "つか"), ("い", ""), ("方", "かた")]),
    (r"考え方", [("考", "かんが"), ("え", ""), ("方", "かた")]),
    (r"やり方", [("やり", ""), ("方", "かた")]),
    (r"選び方", [("選", "えら"), ("び", ""), ("方", "かた")]),
    (r"前の方", [("前", "まえ"), ("の", ""), ("方", "かた")]),
    (r"モデルの方", [("モデル", "もでる"), ("の", ""), ("方", "かた")]),
    (r"右の方", [("右", "みぎ"), ("の", ""), ("方", "かた")]),
    (r"左の方", [("左", "ひだり"), ("の", ""), ("方", "かた")]),
    (r"ほかの方", [("ほかの", ""), ("方", "かた")]),
    (r"お二人", [("お", ""), ("二人", "ふたり")]),
    (r"服作り", [("服", "ふく"), ("作", "づく"), ("り", "")]),
    (r"かばん作り", [("かばん", ""), ("作", "づく"), ("り", "")]),
    (r"ものづくり", [("ものづくり", "")]),
    (r"大学一年", [("大学", "だいがく"), ("一年", "いちねん")]),
    (r"十二月六日", [("十二月", "じゅうにがつ"), ("六日", "むいか")]),
    (r"二十日", [("二十日", "はつか")]),
    (r"二十回", [("二十回", "にじゅっかい")]),
    (r"二十人", [("二十人", "にじゅうにん")]),
    (r"十四日", [("十四日", "じゅうよっか")]),
    (r"一日", [("一日", "いちにち")]),
    (r"一日中", [("一日中", "いちにちじゅう")]),
    (r"立っ", [("立", "た"), ("っ", "")]),
    (r"三つ目", [("三", "みっ"), ("つ", ""), ("目", "め")]),
    (r"四着", [("四着", "よんちゃく")]),
    (r"四回目", [("四回目", "よんかいめ")]),
    (r"三回", [("三回", "さんかい")]),
    (r"二回", [("二回", "にかい")]),
    (r"一回", [("一回", "いっかい")]),
    (r"百回", [("百回", "ひゃっかい")]),
    (r"一年半", [("一年半", "いちねんはん")]),
    (r"二年間", [("二年間", "にねんかん")]),
    (r"三年間", [("三年間", "さんねんかん")]),
    (r"五年間", [("五年間", "ごねんかん")]),
    (r"二年", [("二年", "にねん")]),
    (r"一年", [("一年", "いちねん")]),
    (r"十年後", [("十年後", "じゅうねんご")]),
    (r"十年", [("十年", "じゅうねん")]),
    (r"二十年", [("二十年", "にじゅうねん")]),
    (r"三月", [("三月", "さんがつ")]),
    (r"二月", [("二月", "にがつ")]),
    (r"一月", [("一月", "いちがつ")]),
    (r"七月", [("七月", "しちがつ")]),
    (r"四月", [("四月", "しがつ")]),
    (r"十一月", [("十一月", "じゅういちがつ")]),
    (r"十二月", [("十二月", "じゅうにがつ")]),
    (r"一番", [("一番", "いちばん")]),
    (r"一度", [("一度", "いちど")]),
    (r"二十八時間", [("二十八時間", "にじゅうはちじかん")]),
    (r"第二志望", [("第二志望", "だいにしぼう")]),
    (r"第一志望", [("第一志望", "だいいちしぼう")]),
    (r"本校", [("本校", "ほんこう")]),
    (r"お客様", [("お", ""), ("客様", "きゃくさま")]),
    (r"売り場", [("売", "う"), ("り", ""), ("場", "ば")]),
    (r"一人暮らし", [("一人暮", "ひとりぐ"), ("らし", "")]),
    (r"年上", [("年上", "としうえ")]),
    (r"年下", [("年下", "としした")]),
    (r"布", [("布", "ぬの")]),
    (r"革", [("革", "かわ")]),
    (r"形", [("形", "かたち")]),
    (r"他", [("他", "ほか")]),
    (r"間に", [("間", "あいだ"), ("に", "")]),
    (r"長い間", [("長", "なが"), ("い", ""), ("間", "あいだ")]),
    (r"入れ", [("入", "い"), ("れ", "")]),
    (r"入れなかった", [("入", "はい"), ("れなかった", "")]),
    (r"入れます", [("入", "はい"), ("れます", "")]),
    (r"日本人", [("日本人", "にほんじん")]),
    (r"韓国人", [("韓国人", "かんこくじん")]),
    (r"外国人", [("外国人", "がいこくじん")]),
    (r"入っ", [("入", "はい"), ("っ", "")]),
    (r"入り", [("入", "はい"), ("り", "")]),
    (r"入る", [("入", "はい"), ("る", "")]),
    (r"入学", [("入学", "にゅうがく")]),
    (r"行っ", [("行", "い"), ("っ", "")]),
    (r"通っ", [("通", "かよ"), ("っ", "")]),
    (r"通い", [("通", "かよ"), ("い", "")]),
    (r"通う", [("通", "かよ"), ("う", "")]),
    (r"出し", [("出", "だ"), ("し", "")]),
    (r"出す", [("出", "だ"), ("す", "")]),
    (r"出る", [("出", "で"), ("る", "")]),
    (r"出ま", [("出", "で"), ("ま", "")]),
    (r"出て", [("出", "で"), ("て", "")]),
    (r"出た", [("出", "で"), ("た", "")]),
    (r"変わ", [("変", "か"), ("わ", "")]),
    (r"変え", [("変", "か"), ("え", "")]),
    (r"着て", [("着", "き"), ("て", "")]),
    (r"着た", [("着", "き"), ("た", "")]),
    (r"着る", [("着", "き"), ("る", "")]),
    (r"着ま", [("着", "き"), ("ま", "")]),
    (r"着ら", [("着", "き"), ("ら", "")]),
    (r"着ても", [("着", "き"), ("ても", "")]),
    (r"着ると", [("着", "き"), ("ると", "")]),
    (r"着やす", [("着", "き"), ("やす", "")]),
    (r"上手", [("上手", "じょうず")]),
    (r"古本", [("古本", "ふるほん")]),
    (r"十分", [("十分", "じゅうぶん")]),
    (r"四人", [("四人", "よにん")]),
    (r"四回", [("四回", "よんかい")]),
    (r"四年", [("四年", "よねん")]),
    (r"三人", [("三人", "さんにん")]),
    (r"三日", [("三日", "みっか")]),
    (r"三年", [("三年", "さんねん")]),
    (r"十日後", [("十日後", "とおかご")]),
    (r"十日前", [("十日前", "とおかまえ")]),
    (r"十年前", [("十年前", "じゅうねんまえ")]),
    (r"二日間", [("二日間", "ふつかかん")]),
    (r"二時間", [("二時間", "にじかん")]),
    (r"二週間", [("二週間", "にしゅうかん")]),
    (r"三日間", [("三日間", "みっかかん")]),
    (r"三時間", [("三時間", "さんじかん")]),
    (r"三か月", [("三", "さん"), ("か", ""), ("月", "げつ")]),
    (r"一か月", [("一", "いっ"), ("か", ""), ("月", "げつ")]),
    (r"一週間", [("一週間", "いっしゅうかん")]),
    (r"千回", [("千回", "せんかい")]),
    (r"毎回", [("毎回", "まいかい")]),
    (r"二番目", [("二番目", "にばんめ")]),
    (r"二回目", [("二回目", "にかいめ")]),
    (r"十八歳", [("十八歳", "じゅうはっさい")]),
    (r"一人一分", [("一人", "ひとり"), ("一分", "いっぷん")]),
    (r"一着", [("一着", "いっちゃく")]),
    (r"半年", [("半年", "はんとし")]),
    (r"何番", [("何番", "なんばん")]),
    (r"何々", [("何々", "なになに")]),
    (r"何万円", [("何万円", "なんまんえん")]),
    (r"四時間", [("四時間", "よじかん")]),
    (r"大人", [("大人", "おとな")]),
    (r"神戸", [("神戸", "こうべ")]),
    (r"大阪", [("大阪", "おおさか")]),
    (r"東京", [("東京", "とうきょう")]),
    (r"韓国", [("韓国", "かんこく")]),
]
_FORCE = [(re.compile(p), segs) for p, segs in sorted(FORCE, key=lambda x: -len(x[0]))]

PAIRS = {}   # (표기, 읽기) -> [문장 id ...]


def hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def nfkc(s):
    return unicodedata.normalize("NFKC", s)


def needs_ruby(s):
    return bool(RE_KANJI.search(s) or RE_KATA.search(s) or re.search(r"[A-Za-z0-9]", s))


def align(surface, reading):
    """낱말 하나(표기, 히라가나 읽기) -> [(조각, 읽기 또는 "")]. 한자 덩어리·가타카나 덩어리마다 읽기를 붙임."""
    parts, pos = [], 0
    for m in RE_RUN.finditer(surface):
        if m.start() > pos:
            parts.append((surface[pos:m.start()], False))
        parts.append((m.group(0), True))
        pos = m.end()
    if pos < len(surface):
        parts.append((surface[pos:], False))
    if not any(r for _, r in parts):
        return [(surface, "")]
    pat = "^"
    for txt, isrun in parts:
        if isrun:
            pat += "(.+?)" if not RE_KATA.match(txt) else "(%s)" % re.escape(hira(txt))
        else:
            pat += re.escape(hira(txt))
    pat += "$"
    m = re.match(pat, reading)
    if not m:
        m2 = re.match(pat.replace("(%s)" % "", ""), reading) if False else None
        # 맞추지 못하면 낱말 전체에 읽기를 붙임
        return [(surface, reading)]
    out, gi = [], 1
    for txt, isrun in parts:
        if isrun:
            out.append((txt, m.group(gi)))
            gi += 1
        else:
            out.append((txt, ""))
    return out


def analyse(text):
    """후리가나 없는 문장 -> [(조각, 읽기 또는 "")] (이어 붙이면 text)."""
    n = len(text)
    spans = [None] * n   # 글자마다 (시작, 끝, [(표기,읽기)...]) 강제 구간
    for rx, segs in _FORCE:
        for m in rx.finditer(text):
            if any(spans[i] is not None for i in range(m.start(), m.end())):
                continue
            if "".join(s for s, _ in segs) != m.group(0):
                raise ValueError("FORCE 표기가 맞지 않음: %s" % m.group(0))
            for i in range(m.start(), m.end()):
                spans[i] = (m.start(), m.end(), segs)
    out, i = [], 0
    while i < n:
        if spans[i] is not None:
            s, e, segs = spans[i]
            out.extend(segs)
            i = e
            continue
        j = i
        while j < n and spans[j] is None:
            j += 1
        seg = text[i:j]
        if not needs_ruby(seg):
            out.append((seg, ""))
        else:
            toks = pyopenjtalk.run_frontend(seg)
            k = 0
            for t in toks:
                surf = t["string"]
                real = seg[k:k + len(surf)]
                if nfkc(real) != nfkc(surf):
                    # 표기가 바뀐 낱말(전각 등): 길이를 맞춰 다시 찾음
                    L = len(surf)
                    while L > 0 and nfkc(seg[k:k + L]) != nfkc(surf):
                        L -= 1
                    real = seg[k:k + L] if L else surf
                k += len(real)
                rd = hira(t["read"]) if t["read"] else ""
                if needs_ruby(real) and rd and rd != "、":
                    out.extend(align(real, rd))
                else:
                    out.append((real, ""))
            if k < len(seg):
                out.append((seg[k:], ""))
        i = j
    return out


def render(pairs, sid=""):
    s = ""
    for txt, rd in pairs:
        if rd and needs_ruby(txt):
            if rd == hira(txt):
                # 가타카나 낱말: 읽기는 히라가나
                pass
            s += "[%s|%s]" % (txt, rd)
            PAIRS.setdefault((txt, rd), []).append(sid)
        else:
            s += txt
    return s


def plain_part(src):
    """후리가나만 붙이기(경계·빈칸 표기 없음). 손으로 쓴 [표기|읽기]는 그대로."""
    out, pos = "", 0
    for m in MANUAL.finditer(src):
        out += _ann(src[pos:m.start()])
        out += m.group(0)
        PAIRS.setdefault((m.group(1), m.group(2)), []).append(_SID[0])
        pos = m.end()
    return out + _ann(src[pos:])


_SID = [""]


def _ann(seg):
    if not seg:
        return ""
    return render(analyse(seg), _SID[0])


def annot(src, sid=""):
    """경계 / 와 빈칸 {a|b|c|d} 가 들어간 문장에 후리가나를 붙임."""
    _SID[0] = sid
    src = src.replace(" ", "")
    # 1) 정답으로 채운 문장을 만들고, 글자마다 원래 위치를 기억
    toks, i = [], 0     # ('t', text) | ('/',) | ('c', [opts])
    buf = ""
    while i < len(src):
        ch = src[i]
        if ch == "/":
            if buf:
                toks.append(("t", buf)); buf = ""
            toks.append(("/",))
        elif ch == "{":
            j = src.index("}", i)
            if buf:
                toks.append(("t", buf)); buf = ""
            toks.append(("c", src[i + 1:j].split("|") if "[" not in src[i + 1:j] else _split_top(src[i + 1:j])))
            i = j
        else:
            buf += ch
        i += 1
    if buf:
        toks.append(("t", buf))
    # 손으로 쓴 후리가나가 있으면 그 부분은 표기만 남기고 읽기를 강제 구간으로
    full, marks, manual = "", [], []
    for t in toks:
        if t[0] == "/":
            marks.append(("/", len(full)))
        elif t[0] == "t":
            full = _strip_manual(t[1], full, manual)
        else:
            a = len(full)
            full = _strip_manual(t[1][0], full, manual)
            marks.append(("c", a, len(full), t[1][1:]))
    pairs = _analyse_with_manual(full, manual)
    # 2) 글자 위치에 맞춰 다시 조립
    bounds = sorted(set([m[1] for m in marks] + [m[2] for m in marks if m[0] == "c"]))
    pos, cut = 0, []
    for txt, rd in pairs:
        a, b = pos, pos + len(txt)
        inner = [x for x in bounds if a < x < b]
        if inner and rd:
            raise ValueError("%s: 경계가 낱말 가운데를 자름 — %s (%s)" % (sid, txt, full))
        if inner:
            last = a
            for x in inner:
                cut.append((txt[last - a:x - a], "", last)); last = x
            cut.append((txt[last - a:], "", last))
        else:
            cut.append((txt, rd, a))
        pos = b
    out, k = "", 0
    events = sorted(marks, key=lambda m: m[1])
    ev = 0
    in_c_end = None
    for txt, rd, a in cut:
        while ev < len(events) and events[ev][1] == a:
            e = events[ev]
            if e[0] == "/":
                out += "/"
            else:
                out += "{"
                in_c_end = (e[2], e[3])
            ev += 1
        if rd and needs_ruby(txt):
            out += "[%s|%s]" % (txt, rd)
            PAIRS.setdefault((txt, rd), []).append(sid)
        else:
            out += txt
        if in_c_end and a + len(txt) == in_c_end[0]:
            for o in in_c_end[1]:
                out += "|" + plain_part(o)
            out += "}"
            in_c_end = None
    while ev < len(events):
        if events[ev][0] == "/":
            out += "/"
        ev += 1
    if in_c_end:
        raise ValueError("%s: 빈칸 끝이 낱말 경계와 안 맞음 (%s)" % (sid, full))
    return out


def _split_top(s):
    out, cur, depth = [], "", 0
    for ch in s:
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        if ch == "|" and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def _strip_manual(text, full, manual):
    pos = 0
    for m in MANUAL.finditer(text):
        full += text[pos:m.start()]
        manual.append((len(full), len(full) + len(m.group(1)), m.group(2)))
        full += m.group(1)
        pos = m.end()
    return full + text[pos:]


def _analyse_with_manual(full, manual):
    if not manual:
        return analyse(full)
    out, pos = [], 0
    for a, b, rd in sorted(manual):
        if a > pos:
            out.extend(analyse(full[pos:a]))
        out.append((full[a:b], rd))
        pos = b
    if pos < len(full):
        out.extend(analyse(full[pos:]))
    return out


def dump_pairs():
    rows = []
    for (txt, rd), ids in sorted(PAIRS.items(), key=lambda x: (x[0][0], x[0][1])):
        rows.append("%s\t%s\t%d\t%s" % (txt, rd, len(ids), ids[0]))
    return "\n".join(rows)


if __name__ == "__main__":
    import sys
    for line in sys.stdin:
        line = line.strip()
        if line:
            print(annot(line, "x"))
