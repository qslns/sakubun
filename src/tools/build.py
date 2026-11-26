#!/usr/bin/env python3
"""작문·면접 드릴 — 자료 빌드.

content JSON(문장 원본) -> site/data.js, site/version.json, site/index.html, site/app.js, site/sw.js

문장 표기법 (한 줄에 다 들어감)
  [漢字|かんじ]      후리가나. 한자·가타카나 낱말은 전부 이 꼴이어야 함.
  /                  어순 드릴의 조각 경계.
  {정답|오답|오답|오답}  빈칸 드릴. 첫 번째가 정답.
"""
import argparse, hashlib, json, os, re, shutil, sys, time, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "src")
SITE = os.path.join(ROOT, "site")

RUBY = re.compile(r"\[([^\[\]|]+)\|([^\[\]|]+)\]")
HIRA = re.compile(r"^[ぁ-ゖー]+$")
KANJI = re.compile(r"[一-鿿々〆ヶ]")
KATA = re.compile(r"[ァ-ヺー]")
HANGUL = re.compile(r"[가-힣]")

VOICES = {"n": "ja-JP-NanamiNeural", "k": "ja-JP-KeitaNeural"}
errors, warns = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def split_top(s):
    out, cur, depth = [], "", 0
    for ch in s:
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        if ch == "|" and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def ruby_html(s):
    return RUBY.sub(lambda m: "<ruby>%s<rt>%s</rt></ruby>" % (m.group(1), m.group(2)), s)


def plain(s):
    return RUBY.sub(lambda m: m.group(1), s)


def kana(s):
    return RUBY.sub(lambda m: m.group(2), s)


def parse(src, sid):
    """-> chunks: [[('t', text) | ('c', [opts])]]"""
    src = src.replace(" ", "")
    chunks, cur, buf, i = [], [], "", 0
    while i < len(src):
        ch = src[i]
        if ch == "/":
            if buf:
                cur.append(("t", buf))
            chunks.append(cur)
            cur, buf = [], ""
        elif ch == "{":
            j = src.find("}", i)
            if j < 0:
                err("%s: { 가 닫히지 않음" % sid)
                break
            if buf:
                cur.append(("t", buf))
            buf = ""
            cur.append(("c", split_top(src[i + 1:j])))
            i = j
        else:
            buf += ch
        i += 1
    if buf:
        cur.append(("t", buf))
    chunks.append(cur)
    return [c for c in chunks if c]


def resolved(tokens):
    return "".join(t[1] if t[0] == "t" else t[1][0] for t in tokens)


def count_chars(s):
    return len(re.sub(r"\s", "", s))


def check_text(src_resolved, sid, words, used_words, need_dict=True):
    """후리가나 완전성 검사 + 손으로 쓸 낱말 모으기(need_dict=False 면 사전 검사 없음: 말로만 하는 문장)."""
    bare = RUBY.sub("", src_resolved)
    if KANJI.search(bare):
        err("%s: 후리가나 없는 한자 — %s" % (sid, bare))
    if re.search(r"[ァ-ヺ]", bare):
        err("%s: 히라가나 읽기 없는 가타카나 — %s" % (sid, bare))
    if HANGUL.search(src_resolved):
        err("%s: 일본어 칸에 한글" % sid)
    for m in RUBY.finditer(src_resolved):
        base, rd = m.group(1), m.group(2)
        if not HIRA.match(rd):
            err("%s: 읽기가 히라가나가 아님 — %s|%s" % (sid, base, rd))
        key = base + "|" + rd
        if not need_dict:
            continue
        if key not in words:
            err("%s: 낱말 사전에 없음 — %s" % (sid, key))
        else:
            used_words.setdefault(key, []).append(sid)


TTS_SUB = [("COMOLI", "コモリ"), ("JPT", "ジェーピーティー"), ("N2", "エヌに"), ("SNS", "エスエヌエス"), ("AI", "エーアイ"), ("IT", "アイティー"), ("〇〇", "何々")]


def tts_text(p):
    for a, b in TTS_SUB:
        p = p.replace(a, b)
    return p


def build_sentence(sid, obj, words, used_words, voice="n", limit=40, hw=True):
    src = obj["ja"]
    limit = obj.get("limit", limit)
    chunks = parse(src, sid)
    toks = [t for c in chunks for t in c]
    full = resolved(toks)
    check_text(full, sid, words, used_words, need_dict=hw)
    p = plain(full)
    n = count_chars(p)
    if limit and n > limit:
        err("%s: %d자 — %d자 넘음: %s" % (sid, n, limit, p))
    if not re.search(r"[。？]$", p):
        err("%s: 문장 끝 부호 없음: %s" % (sid, p))
    cloze = []
    for idx, t in enumerate(toks):
        if t[0] != "c":
            continue
        opts = t[1]
        if len(opts) != 4:
            err("%s: 빈칸 보기가 4개가 아님 — %s" % (sid, opts))
        if len(set(plain(o) for o in opts)) != len(opts):
            err("%s: 빈칸 보기가 겹침 — %s" % (sid, opts))
        for o in opts[1:]:
            check_text(o, sid + "(보기)", words, {}, need_dict=False)
        cloze.append({
            "pre": ruby_html(resolved(toks[:idx])),
            "post": ruby_html(resolved(toks[idx + 1:])),
            "opts": [ruby_html(o) for o in opts],
        })
    ch = [{"h": ruby_html(resolved(c)), "p": plain(resolved(c))} for c in chunks]
    if len(ch) < 3 and not obj.get("noorder"):
        warn("%s: 어순 조각이 %d개 (어순 드릴 없음)" % (sid, len(ch)))
    if len(ch) > 8:
        err("%s: 어순 조각이 %d개 — 너무 많음" % (sid, len(ch)))
    if not cloze and not obj.get("nocloze"):
        warn("%s: 빈칸 없음" % sid)
    tts = obj.get("tts") or tts_text(p)
    v = obj.get("v", voice)
    out = {
        "ko": obj["ko"], "html": ruby_html(full), "plain": p, "kana": kana(full),
        "chunks": ch if len(ch) >= 3 else [], "cloze": cloze, "n": n,
        "au": au_hash(v, tts),
    }
    for k in ("role", "when", "ref", "fr"):
        if obj.get(k):
            out[k] = obj[k]
    if obj.get("st", "ok") != "ok":
        out["st"] = obj["st"]
    if obj.get("o"):
        out["o"] = 1          # 원서·이력서에 쓴 문장 그대로
    SRCTAG[sid] = {"src": obj.get("src", ""), "st": obj.get("st", "ok"), "ref": obj.get("ref", "")}
    AUDIO[out["au"]] = {"v": v, "text": tts, "id": sid, "kana": obj.get("ttsk") or out["kana"]}
    return out


AUDIO = {}
SRCTAG = {}


def au_hash(v, text):
    return hashlib.sha1((VOICES[v] + "|" + text).encode("utf-8")).hexdigest()[:12]


def build_q(uid, q, words, used_words):
    """질문: 나나미(au)와 게이타(auk) 두 목소리를 다 만듦. 설정에서 고름(기본은 나나미)."""
    full = q["ja"].replace(" ", "")
    check_text(full, uid + ".q", words, {}, need_dict=False)
    p = plain(full)
    tts = q.get("tts") or tts_text(p)
    out = {"html": ruby_html(full), "plain": p, "kana": kana(full), "ko": q["ko"]}
    for v, key in (("n", "au"), ("k", "auk")):
        h = au_hash(v, tts)
        AUDIO[h] = {"v": v, "text": tts, "id": uid + ".q", "kana": q.get("ttsk") or kana(full)}
        out[key] = h
    return out


def genko_rows(paras, cols=20):
    rows = 0
    for p in paras:
        rows += -(-(1 + count_chars(p)) // cols)
    return rows


def load_strokes(chars):
    out, missing = {}, []
    kdir = os.path.join(SRC, "kvg")
    for ch in sorted(chars):
        f = os.path.join(kdir, "%05x.svg" % ord(ch))
        if not os.path.exists(f):
            missing.append(ch)
            continue
        svg = open(f, encoding="utf-8").read()
        ds = re.findall(r'<path[^>]*\sd="([^"]+)"', svg)
        out[ch] = ds
    return out, missing


# 너무 기본적인 말은 단어장 표시에서 뺌(화면이 복잡해지지 않게)
VOC_STOP = set("つく ない まだ ある いる する なる できる よい いい こと もの とき ところ ため ほう よう みんな 今 人 私 それ これ そこ ここ どこ 何 とても たくさん 少し もう ずっと 好き 多い 思う 見る 行く 来る 言う 日本 韓国 学校 服 かばん 作る 時 中 前 後 上 下 年 日 月".split())


def vocab_hits(text, vocab):
    """문장 속 낱말 가운데 단어장(bjt-words)에 있는 것. OpenJTalk 기본형으로 찾음."""
    import pyopenjtalk
    out, seen = [], set()
    for t in pyopenjtalk.run_frontend(text):
        if t["pos"] not in ("名詞", "動詞", "形容詞", "副詞", "形容動詞"):
            continue
        if t["pos_group1"] in ("非自立", "接尾", "数", "代名詞"):
            continue
        base = t["orig"] if t["orig"] and t["orig"] != "*" else t["string"]
        if base in VOC_STOP:
            continue
        cands = vocab["w"].get(base) or vocab["w"].get(t["string"])
        if not cands and re.match(r"^[ぁ-ゖー]{3,}$", base):
            cands = vocab["r"].get(base)
            if cands and len(cands) != 1:
                cands = None
        if not cands:
            continue
        v = cands[0]
        if v["id"] in seen:
            continue
        seen.add(v["id"])
        out.append(v["id"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", default=os.path.join(SRC, "content", "content.json"))
    ap.add_argument("--out", default=SITE)
    ap.add_argument("--strict-audio", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    C = json.load(open(a.content, encoding="utf-8"))
    words = C.get("words", {})
    used = {}
    sents, units = {}, []

    def add_unit(u):
        own = [x for x in u["s"] if not sents[x].get("ref")]
        u["chk"] = len([x for x in own if sents[x].get("st")])        # 확인이 필요한 문장 수
        u["draft"] = u["chk"] > 0
        units.append(u)

    block_by_no = {}
    for b in C.get("blocks", []):
        uid = b["id"]
        sids = []
        for i, s in enumerate(b["s"], 1):
            sid = "%s.%d" % (uid, i)
            sents[sid] = build_sentence(sid, s, words, used)
            sents[sid]["u"] = uid
            sids.append(sid)
        u = {"id": uid, "kind": "b", "no": b["no"], "ko": b["ko"], "s": sids,
             "q": build_q(uid, b["q"], words, used), "say": sids[:b.get("say", 2)]}
        u["n"] = sum(sents[x]["n"] for x in sids)
        if not (90 <= u["n"] <= 110):
            warn("%s: 블록 %d자 (90~110 목표)" % (uid, u["n"]))
        block_by_no[b["no"]] = u
        add_unit(u)
    by_id = {u["id"]: u for u in units}

    def assemble(first, body_items, last):
        body_text = ""
        for it in body_items:
            if "b" in it:
                body_text += "".join(sents[x]["plain"] for x in by_id[it["b"]]["s"])
            else:
                body_text += sents[it["s"]]["plain"]
        paras = [sents[first]["plain"], body_text, sents[last]["plain"]]
        return sum(count_chars(p) for p in paras), genko_rows(paras)

    frames = {}
    for t in C.get("topics", []):
        uid = t["id"]
        sids = []
        f = uid + ".f"
        sents[f] = build_sentence(f, t["first"], words, used, limit=39)
        sents[f]["u"] = uid
        sents[f]["role"] = "첫 문장"
        sids.append(f)
        xs = []
        for i, s in enumerate(t.get("extra", []), 1):
            sid = "%s.x%d" % (uid, i)
            sents[sid] = build_sentence(sid, s, words, used)
            sents[sid]["u"] = uid
            sents[sid]["role"] = "이 주제 전용"
            sids.append(sid)
            xs.append(sid)
        l = uid + ".l"
        sents[l] = build_sentence(l, t["last"], words, used, limit=39)
        sents[l]["u"] = uid
        sents[l]["role"] = "끝 문장"
        sids.append(l)
        check_text(t["ja"], uid + ".title", words, {}, need_dict=False)
        if t.get("frame"):
            # 처음 보는 주제용 틀: 문장마다 fr = 첫 · 의견 · 연결1 · 연결2 · 끝
            FRN = {"첫": "첫 문장", "의견": "좋은 점·나쁜 점이 있는 주제일 때", "연결1": "연결 ① 내 생각을 쓴 뒤에", "연결2": "연결 ② 사실·일상을 쓴 뒤에", "끝": "끝 문장"}
            for sid in sids:
                fr = sents[sid].get("fr")
                if fr not in FRN:
                    err("%s: 틀 표시(fr) 없음" % sid)
                    continue
                frames[fr] = sid
                sents[sid]["role"] = "틀 · " + FRN[fr]
            # 만능 작문: 틀만으로 쓰는 기본 글 = 첫 문장 → (본문 블록들) → 끝 문장
            body = []
            for tok in t.get("body", []):
                if not tok.startswith("b") or int(tok[1:]) not in block_by_no:
                    err("%s: 만능 작문의 본문은 블록만 (%s)" % (uid, tok))
                    continue
                body.append({"b": block_by_no[int(tok[1:])]["id"]})
            n = rows = 0
            if body and "첫" in frames and "끝" in frames:
                n, rows = assemble(frames["첫"], body, frames["끝"])
                if not (360 <= n <= 400):
                    warn("%s: 만능 작문 %d자 (360~400 목표)" % (uid, n))
                if rows > 20:
                    warn("%s: 만능 작문이 원고지 20×20에서 %d줄 (20줄 넘음)" % (uid, rows))
            u = {"id": uid, "kind": "t", "no": t["no"], "ko": t["ko"], "ja": ruby_html(t["ja"]), "jap": plain(t["ja"]),
                 "s": sids, "body": body, "blocks": [it["b"] for it in body], "n": n, "rows": rows, "fr": 1}
            add_unit(u)
            continue
        body = []
        for tok in t["body"]:
            if tok.startswith("b"):
                no = int(tok[1:])
                if no not in block_by_no:
                    err("%s: 블록 %s 없음" % (uid, tok))
                    continue
                body.append({"b": block_by_no[no]["id"]})
            else:
                k = int(tok[1:]) - 1
                if k >= len(xs):
                    err("%s: 전용 문장 %s 없음" % (uid, tok))
                    continue
                body.append({"s": xs[k]})
        n, rows = assemble(f, body, l)
        if not (360 <= n <= 400):
            warn("%s: 조립 %d자 (360~400 목표)" % (uid, n))
        if rows > 20:
            warn("%s: 원고지 20×20에서 %d줄 (20줄 넘음)" % (uid, rows))
        u = {"id": uid, "kind": "t", "no": t["no"], "ko": t["ko"], "ja": ruby_html(t["ja"]),
             "jap": plain(t["ja"]), "s": sids, "body": body,
             "blocks": [it["b"] for it in body if "b" in it], "n": n, "rows": rows}
        add_unit(u)

    for it in C.get("iv", []):
        uid = it["id"]
        sids = []
        for i, s in enumerate(it["s"], 1):
            sid = "%s.%d" % (uid, i)
            sents[sid] = build_sentence(sid, s, words, used, hw=False)
            sents[sid]["u"] = uid
            sids.append(sid)
        u = {"id": uid, "kind": "i", "ko": it["ko"], "s": sids,
             "q": build_q(uid, it["q"], words, used), "say": sids}
        add_unit(u)

    for it in C.get("em", []):
        uid = it["id"]
        sids = []
        for i, s in enumerate(it["s"], 1):
            sid = "%s.%d" % (uid, i)
            sents[sid] = build_sentence(sid, s, words, used, hw=False, limit=45)
            sents[sid]["u"] = uid
            sids.append(sid)
        add_unit({"id": uid, "kind": "e", "ko": it["ko"], "s": sids})

    by_id = {u["id"]: u for u in units}
    order = C.get("order") or [u["id"] for u in units]
    for x in order:
        if x not in by_id:
            err("order: %s 없음" % x)
    for u in units:
        if u["id"] not in order:
            err("order에 빠짐: %s" % u["id"])
    if len(set(order)) != len(order):
        err("order에 겹침")

    # ── 예상 질문 전체: 질문 → 연결된 답(외운 문장) 또는 짧은 답 ──
    def resolve(ans, qid):
        if isinstance(ans, dict):      # 짧은 답
            full = ans["ja"]
            check_text(full, qid + ".sa", words, {}, need_dict=False)
            p = plain(full)
            n = count_chars(p)
            if n > 45:
                err("%s: 짧은 답이 %d자 — %s" % (qid, n, p))
            tts = ans.get("tts") or tts_text(p)
            h = au_hash("n", tts)
            AUDIO[h] = {"v": "n", "text": tts, "id": qid + ".sa", "kana": ans.get("ttsk") or kana(full)}
            SRCTAG[qid + ".sa%d" % (len([k for k in SRCTAG if k.startswith(qid + ".sa")]) + 1)] = {"src": ans.get("src", ""), "st": ans.get("st", "ok"), "ref": ""}
            o = {"sa": {"html": ruby_html(full), "plain": p, "kana": kana(full), "ko": ans["ko"], "au": h}}
            if ans.get("st", "ok") != "ok":
                o["sa"]["st"] = ans["st"]
            return o
        uid, _, sub = ans.partition(":")
        if uid not in by_id:
            err("%s: 답 단위 %s 없음" % (qid, uid))
            return None
        u = by_id[uid]
        if not sub:
            sids = u.get("say") or u["s"]
        else:
            sids = []
            for k in sub.split(","):
                sid = "%s.%s" % (uid, k)
                if sid not in sents:
                    err("%s: 답 문장 %s 없음" % (qid, sid))
                    continue
                sids.append(sid)
        return {"u": uid, "s": sids}

    qs = []
    for qq in C.get("qs", []):
        d = build_q(qq["id"], qq, words, used)
        d.update({"id": qq["id"], "cat": qq["cat"], "a": [x for x in (resolve(aa, qq["id"]) for aa in qq["a"]) if x]})
        for k in ("par", "rel", "note", "ch"):
            if qq.get(k):
                d[k] = qq[k]
        if qq.get("hard"):
            d["hard"] = 1
        if qq.get("core"):
            d["core"] = 1
        n_ans = sum(sents[sid]["n"] for x in d["a"] if "u" in x for sid in x["s"]) + sum(count_chars(x["sa"]["plain"]) for x in d["a"] if "sa" in x)
        d["n"] = n_ans
        if n_ans > 130:
            warn("%s: 답이 %d자 — 20초 안에 말하기 어려울 수 있음" % (qq["id"], n_ans))
        if any(x.get("sa", {}).get("st") for x in d["a"]) or any(sents[sid].get("st") for x in d["a"] if "u" in x for sid in x["s"]):
            d["chk"] = 1
        SRCTAG[qq["id"]] = {"src": qq.get("src", ""), "st": "ok", "ref": ""}
        qs.append(d)
    qids = {x["id"] for x in qs}
    for x in qs:
        if x.get("par") and x["par"] not in qids:
            err("%s: 큰 질문 %s 없음" % (x["id"], x["par"]))

    # ── 처음 보는 주제: 준비한 주제와 같은 글(same) 또는 틀 첫 문장 + 주제에 답하는 문장(두세 개) + 연결 문장(①·②) + 블록 2개 + 끝 문장 ──
    unseen = []
    for t in C.get("unseen", []):
        check_text(t["ja"], t["id"] + ".title", words, {}, need_dict=False)
        base = {"id": t["id"], "ja": ruby_html(t["ja"]), "jap": plain(t["ja"]), "ko": t["ko"], "tip": t.get("tip", "")}
        if t.get("same"):
            u = by_id.get(t["same"])
            if not u or u["kind"] != "t" or u.get("fr"):
                err("%s: 같은 글로 쓸 주제 %s 없음" % (t["id"], t["same"]))
                continue
            base.update({"same": u["id"], "n": u["n"], "rows": u["rows"]})
            unseen.append(base)
            continue
        cl = "끝"
        brk = "연결%d" % t.get("br", 1)
        if "첫" not in frames or brk not in frames or cl not in frames:
            err("%s: 틀 문장(첫·%s·%s) 없음" % (t["id"], brk, cl))
            continue
        xs = []
        for k, x in enumerate(t.get("xs", []), 1):
            check_text(x["ja"], "%s.x%d" % (t["id"], k), words, {}, need_dict=False)
            px = plain(x["ja"])
            if count_chars(px) > 40:
                err("%s.x%d: %d자 — 40자 넘음: %s" % (t["id"], k, count_chars(px), px))
            xo = {"html": ruby_html(x["ja"]), "plain": px, "ko": x["ko"]}
            if x.get("st", "ok") != "ok":
                xo["st"] = x["st"]
            xs.append(xo)
            SRCTAG["%s.x%d" % (t["id"], k)] = {"src": t.get("src", ""), "st": x.get("st", "ok"), "ref": ""}
        body = []
        for tok in t["body"]:
            no = int(tok[1:])
            if no not in block_by_no:
                err("%s: 블록 %s 없음" % (t["id"], tok))
                continue
            body.append({"b": block_by_no[no]["id"]})
        btxt = "".join(x["plain"] for x in xs) + sents[frames[brk]]["plain"] + "".join(sents[sid]["plain"] for it in body for sid in by_id[it["b"]]["s"])
        paras = [sents[frames["첫"]]["plain"], btxt, sents[frames[cl]]["plain"]]
        n, rows = sum(count_chars(p) for p in paras), genko_rows(paras)
        if not (355 <= n <= 400):
            warn("%s(%s): 조립 %d자 (355~400 목표)" % (t["id"], t["ko"], n))
        if rows > 20:
            warn("%s(%s): 원고지 20×20에서 %d줄 (20줄 넘음)" % (t["id"], t["ko"], rows))
        base.update({"f": frames["첫"], "x": xs, "br": frames[brk], "brn": t.get("br", 1), "body": body, "blocks": [it["b"] for it in body], "l": frames[cl], "n": n, "rows": rows})
        if any(x.get("st") for x in xs):
            base["chk"] = 1
        unseen.append(base)

    # 손으로 쓸 낱말: 과정 순서대로 처음 나오는 단위에 붙임
    sid_unit_pos = {}
    for pos, uid in enumerate(order):
        if uid in by_id:
            for k, sid in enumerate(by_id[uid]["s"]):
                sid_unit_pos[sid] = (pos, k)
    # 문장이 작문 몇 편에 들어가는지(글자 연습 순서를 '글에 많이 나오는 것부터'로 정하는 데 씀)
    use_n = {}
    for u in units:
        if u["kind"] == "t":
            for sid in u["s"]:
                use_n[sid] = use_n.get(sid, 0) + 1
            for bid in u.get("blocks", []):
                for sid in by_id[bid]["s"]:
                    use_n[sid] = use_n.get(sid, 0) + 1
    lemmas = {}
    for key, sids in used.items():
        w = words[key]
        real = [s for s in sids if s in sid_unit_pos]
        if not real:
            continue
        first = min(real, key=lambda s: sid_unit_pos[s])
        L = lemmas.setdefault(w["w"], {"w": w["w"], "r": w["r"], "ko": w["ko"], "first": first, "cnt": 0, "wt": 0})
        L["cnt"] += len(real)
        L["wt"] += sum(use_n.get(x, 0) for x in real)
        if sid_unit_pos[first] < sid_unit_pos[L["first"]]:
            L["first"] = first
    for key in words:
        if key not in used:
            warn("낱말 사전에 있지만 작문 문장에 안 나옴: %s" % key)
    wl = sorted(lemmas.values(), key=lambda L: sid_unit_pos[L["first"]])
    wordlist, chars = [], set()
    for i, L in enumerate(wl):
        cs = [c for c in L["w"] if KANJI.match(c) or KATA.match(c)]
        chars.update(cs)
        wid = "w%03d" % (i + 1)
        wordlist.append({"id": wid, "w": L["w"], "r": L["r"], "ko": L["ko"], "ex": L["first"],
                         "u": sents[L["first"]]["u"], "cnt": L["cnt"], "wt": L["wt"], "chars": cs})
    worder = [w["id"] for w in sorted(wordlist, key=lambda w: (-w["wt"], w["id"]))]

    # ── 단어장(bjt-words)에 있는 낱말 표시 ──
    voc, vfile = {}, os.path.join(SRC, "content", "vocab_words.json")
    if os.path.exists(vfile):
        V = json.load(open(vfile, encoding="utf-8"))
        idx = {"w": {}, "r": {}}
        for v in V:
            idx["w"].setdefault(v["w"], []).append(v)
            idx["r"].setdefault(v["r"], []).append(v)
        vid = {v["id"]: v for v in V}
        for sid, se in sents.items():
            hits = vocab_hits(se["plain"], idx)
            if hits:
                se["voc"] = hits
                for h in hits:
                    v = vid[h]
                    voc[str(h)] = {"w": v["w"], "r": v["r"], "m": v["m"], "t": ("N%d" % v["jl"]) if v.get("jl") else ("기본" if v["t"] == "K" else "단어장")}
    else:
        warn("단어장 자료(vocab_words.json) 없음 — 낱말 표시 없이 만듦")

    # 날짜표 검사: 종류별 합이 실제 개수와 같아야 함. 쓸 글자 수가 다르면 마지막 글자 날에서 맞춤.
    days = json.loads(json.dumps(C.get("days", {})))
    if not days or not C.get("start"):
        err("날짜표(days)·시작일(start) 없음")
    for k, name in (("b", "블록"), ("t", "주제"), ("i", "면접 답"), ("e", "인사")):
        want = len([u for u in units if u["kind"] == k])
        got = sum(r.get(k, 0) for r in days.values())
        if want != got:
            err("날짜표 %s 합 %d ≠ 실제 %d" % (name, got, want))
    qsum = sum(r.get("q", 0) for r in days.values())
    qmain = [x for x in qs if x.get("rel") != "var"]   # 세는 질문 = 큰 질문 + 이어지는 꼬리 질문(바꿔 묻는 말은 세지 않음)
    if qs and qsum < len(qmain):
        err("날짜표 질문 훑기 합 %d < 날마다 훑는 질문 %d" % (qsum, len(qmain)))
    wsum = sum(r.get("w", 0) for r in days.values())
    if days and wsum != len(wordlist):
        lastw = max(d for d, r in days.items() if r.get("w"))
        days[lastw]["w"] += len(wordlist) - wsum
        warn("날짜표 쓸 글자 합 %d ≠ 낱말 %d → %s을 %d개로 맞춤" % (wsum, len(wordlist), lastw, days[lastw]["w"]))
        if days[lastw]["w"] < 0:
            err("날짜표 쓸 글자 수가 너무 많음")
    for u in units:
        u["hw"] = [w["id"] for w in wordlist if w["u"] == u["id"]]
    strokes, missing = load_strokes(chars)
    if missing:
        warn("획순 자료 없음: " + "".join(missing))

    # 음성
    adir = os.path.join(a.out, "audio")
    os.makedirs(adir, exist_ok=True)
    miss_audio = [h for h in AUDIO if not os.path.exists(os.path.join(adir, h + ".mp3"))]
    json.dump(AUDIO, open(os.path.join(SRC, "content", "audio_jobs.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump(SRCTAG, open(os.path.join(SRC, "content", "sources.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if miss_audio:
        (err if a.strict_audio else warn)("음성 파일 없음: %d개" % len(miss_audio))

    own = [sid for sid, se in sents.items() if not se.get("ref")]
    uniq = {}
    for sid in own:
        uniq.setdefault(sents[sid]["plain"], sid)
    stats = {
        "units": len(units), "sents": len(sents), "sents_own": len(own), "sents_unique": len(uniq),
        "sents_chk": len([x for x in own if sents[x].get("st") == "chk"]),
        "sents_pend": len([x for x in own if sents[x].get("st") == "pend"]),
        "words": len(wordlist), "kanji": len([c for c in chars if KANJI.match(c)]),
        "kata_words": len([w for w in wordlist if not any(KANJI.match(c) for c in w["w"])]),
        "qs": len(qs), "qs_main": len([x for x in qs if not x.get("par")]), "sa": len([1 for x in qs for y in x["a"] if "sa" in y]),
        "unseen": [{"id": t["id"], "n": t["n"], "rows": t["rows"]} for t in unseen],
        "voc": len(voc),
        "audio": len(AUDIO), "audio_missing": len(miss_audio),
        "topics": [{"id": u["id"], "n": u["n"], "rows": u["rows"]} for u in units if u["kind"] == "t" and not u.get("fr")],
        "blocks": [{"id": u["id"], "n": u["n"]} for u in units if u["kind"] == "b"],
        "kinds": {k: len([u for u in units if u["kind"] == k]) for k in "btie"},
    }

    if errors:
        print("오류 %d개" % len(errors))
        for e in errors:
            print("  ✕", e)
        sys.exit(1)

    data = {
        "exam": C["exam"], "start": C.get("start"), "days": days, "rest": C.get("rest", {}),
        "units": units, "sents": sents, "words": wordlist, "worder": worder, "strokes": strokes, "order": order,
        "qs": qs, "qcats": C.get("qcats", []), "qch": C.get("qch", []), "unseen": unseen, "frames": frames, "voc": voc,
        "notes": C.get("notes", {}),
    }
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    app_js = open(os.path.join(SRC, "app", "app.js"), encoding="utf-8").read()
    html = open(os.path.join(SRC, "app", "index.html"), encoding="utf-8").read()
    sw = open(os.path.join(SRC, "app", "sw.js"), encoding="utf-8").read()
    ver = hashlib.sha1((blob + app_js + html + sw).encode("utf-8")).hexdigest()[:10]
    stamp = time.strftime("%m%d-%H%M", time.localtime())
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "data.js"), "w", encoding="utf-8") as f:
        f.write("window.DATA=" + blob + ";window.DATA.ver=%s;window.DATA.stamp=%s;" % (json.dumps(ver), json.dumps(stamp)))
    with open(os.path.join(a.out, "app.js"), "w", encoding="utf-8") as f:
        f.write(app_js)
    with open(os.path.join(a.out, "index.html"), "w", encoding="utf-8") as f:
        f.write(html.replace("__VER__", ver))
    with open(os.path.join(a.out, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw.replace("__VER__", ver))
    with open(os.path.join(a.out, "version.json"), "w", encoding="utf-8") as f:
        json.dump({"ver": ver, "stamp": stamp}, f)
    open(os.path.join(a.out, ".nojekyll"), "w").close()
    json.dump(stats, open(os.path.join(SRC, "content", "stats.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    if not a.quiet:
        print("판 %s (%s) · 단위 %d · 문장 %d(외울 것 %d · 확인 필요 %d · 답 대기 %d) · 손으로 쓸 낱말 %d (한자 %d자) · 질문 %d · 음성 %d (없음 %d)" % (
            ver, stamp, stats["units"], stats["sents"], stats["sents_unique"], stats["sents_chk"], stats["sents_pend"],
            stats["words"], stats["kanji"], stats["qs"], stats["audio"], stats["audio_missing"]))
        for w in warns:
            print("  ·", w)


if __name__ == "__main__":
    main()
