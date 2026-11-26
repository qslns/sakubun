#!/usr/bin/env python3
"""문장 세트를 프로젝트 문서용 마크다운으로: 일본어 + 히라가나 읽기 + 한국어 뜻 + 출처·상태.  -> review/문장.md
머리글은 src/content/md_head.md (숫자는 {…} 자리에 넣음)."""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUBY = re.compile(r"\[([^\[\]|]+)\|([^\[\]|]+)\]")
CIRC = "①②③④⑤⑥⑦⑧"
STN = {"chk": "확인 필요", "pend": "답 대기"}


def split_top(s):
    out, cur, d = [], "", 0
    for ch in s:
        if ch == "[":
            d += 1
        elif ch == "]":
            d -= 1
        if ch == "|" and d == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def clean(src):
    src = src.replace(" ", "").replace("/", "")
    return re.sub(r"\{([^{}]*)\}", lambda m: split_top(m.group(1))[0], src)


plain = lambda s: RUBY.sub(lambda m: m.group(1), clean(s))
kana = lambda s: RUBY.sub(lambda m: m.group(2), clean(s))


def main():
    C = json.load(open(os.path.join(ROOT, "src", "content", "content.json"), encoding="utf-8"))
    st = json.load(open(os.path.join(ROOT, "src", "content", "stats.json"), encoding="utf-8"))
    hp = os.path.join(ROOT, "src", "content", "md_head.md")
    head = open(hp, encoding="utf-8").read() if os.path.exists(hp) else ""
    tn = [t["n"] for t in st["topics"]]
    un = [t["n"] for t in st["unseen"]]
    head = head.format(units=st["units"], sents=st["sents_unique"], chk=st["sents_chk"], pend=st["sents_pend"], words=st["words"], kanji=st["kanji"],
                       qs=st["qs"], qmain=st["qs_main"], sa=st["sa"], tmin=min(tn), tmax=max(tn), umin=min(un), umax=max(un), nun=len(un),
                       bmin=min(b["n"] for b in st["blocks"]), bmax=max(b["n"] for b in st["blocks"]), audio=st["audio"])
    L = [head.rstrip(), ""]
    n = [0]
    num = {}

    def row(sid, s, tag=""):
        if s.get("ref"):
            L.append("- (%s번 문장을 그대로 다시 씀) %s" % (num.get(s["ref"], "?"), plain(s["ja"])))
            return
        n[0] += 1
        num[sid] = n[0]
        mark = (" 〔%s〕" % STN[s["st"]]) if s.get("st", "ok") != "ok" else ""
        L.append("%d. %s%s%s" % (n[0], ("**" + tag + "** " if tag else ""), plain(s["ja"]), mark))
        L.append("   - %s" % kana(s["ja"]))
        L.append("   - %s" % s["ko"])
        L.append("   - 출처: %s" % (s.get("src") or "-"))

    L.append("## 블록 8개 (각 3문장 · 작문과 면접에 같이 씀)\n")
    for b in C["blocks"]:
        L.append("### 블록 %s %s" % (CIRC[b["no"] - 1], b["ko"]))
        L.append("면접 질문: %s (%s)\n" % (plain(b["q"]["ja"]), b["q"]["ko"]))
        for i, s in enumerate(b["s"], 1):
            row("%s.%d" % (b["id"], i), s, s.get("role", ""))
        L.append("")
    L.append("## 작문 주제 15개 (첫 문장 + 본문 + 끝 문장) · 주제 16 = 처음 보는 주제용 틀\n")
    tstat = {t["id"]: t for t in st["topics"]}
    for t in C["topics"]:
        if t.get("frame"):
            L.append("### 틀 (주제 16) %s" % t["ko"])
            L.append("쓰는 법: 첫 문장 → 주제에 답하는 문장 두세 개(그 자리에서 지음) → 연결 문장(내 생각을 썼으면 ①, 사실이나 일상을 썼으면 ②) → 블록 2개 → 끝 문장\n")
            row(t["id"] + ".f", t["first"], "틀·" + t["first"].get("fr", ""))
            for i, s in enumerate(t.get("extra", []), 1):
                row("%s.x%d" % (t["id"], i), s, "틀·" + s.get("fr", ""))
            row(t["id"] + ".l", t["last"], "틀·" + t["last"].get("fr", ""))
            L.append("")
            continue
        body = " → ".join(("블록 " + CIRC[int(x[1:]) - 1]) if x[0] == "b" else "전용 " + x[1:] for x in t["body"])
        L.append("### 주제 %d %s (%s)" % (t["no"], t["ko"], plain(t["ja"])))
        L.append("조립: 첫 문장 → %s → 끝 문장 · %d자 · 원고지 %d줄\n" % (body, tstat[t["id"]]["n"], tstat[t["id"]]["rows"]))
        row(t["id"] + ".f", t["first"], "첫 문장")
        for i, s in enumerate(t.get("extra", []), 1):
            row("%s.x%d" % (t["id"], i), s, "전용 %d" % i)
        row(t["id"] + ".l", t["last"], "끝 문장")
        L.append("")
    L.append("## 면접 답 %d개 (각 2문장 안팎 · 말로만) — 외우는 순서\n" % len(C["iv"]))
    for it in C["iv"]:
        L.append("### %s %s" % (it["id"].replace("i", "면접 "), it["ko"]))
        L.append("질문: %s (%s)\n" % (plain(it["q"]["ja"]), it["q"]["ko"]))
        for i, s in enumerate(it["s"], 1):
            row("%s.%d" % (it["id"], i), s)
        L.append("")
    L.append("## 인사 · 비상 · 그룹 면접에서 쓰는 말 (말로만)\n")
    for it in C["em"]:
        L.append("### %s\n" % it["ko"])
        for i, s in enumerate(it["s"], 1):
            row("%s.%d" % (it["id"], i), s, s.get("when", ""))
        L.append("")

    # 예상 질문 전체
    L.append("## 예상 질문 전체 %d개 (질문 → 연결된 답)\n" % len(C["qs"]))
    L.append("답의 번호는 위 문장 번호예요. [짧은 답]은 그 질문에만 쓰는 한 문장(외우는 과정에는 안 들어가고 앱의 '예상 질문 전체'에서 연습).\n")
    units = {u["id"]: u for u in C["blocks"] + C["topics"] + C["iv"] + C["em"]}

    def ans_text(a):
        if isinstance(a, dict):
            m = (" 〔%s〕" % STN[a["st"]]) if a.get("st", "ok") != "ok" else ""
            return "[짧은 답] %s (%s)%s" % (plain(a["ja"]), a["ko"], m)
        uid, _, sub = a.partition(":")
        if not sub:
            k = 2 if uid.startswith("b") else len(units[uid]["s"])
            sids = ["%s.%d" % (uid, i) for i in range(1, k + 1)]
        else:
            sids = ["%s.%s" % (uid, x) for x in sub.split(",")]
        return "·".join(str(num.get(s, num.get(_refof(s), "?"))) for s in sids) + "번"

    refs = {}
    for it in C["iv"]:
        for i, s in enumerate(it["s"], 1):
            if s.get("ref"):
                refs["%s.%d" % (it["id"], i)] = s["ref"]

    def _refof(sid):
        return refs.get(sid, sid)

    cat = None
    for q in C["qs"]:
        if q["cat"] != cat:
            cat = q["cat"]
            L.append("\n### %s. %s\n" % (cat, dict(C["qcats"])[cat]))
        rel = {"fu": "↳ ", "var": "≈ "}.get(q.get("rel"), "")
        L.append("- `%s` %s%s%s (%s) → %s" % (q["id"], rel, "[압박] " if q.get("hard") else "", plain(q["ja"]), q["ko"], " + ".join(ans_text(a) for a in q["a"])))
    L.append("")

    # 처음 보는 주제
    L.append("## 처음 보는 주제 %d개\n" % len(C["unseen"]))
    tp = {t["id"]: t for t in C["topics"]}
    us = {t["id"]: t for t in st["unseen"]}
    for t in C["unseen"]:
        if t.get("same"):
            L.append("- %s (%s) → 주제 %s(%s)와 같은 글" % (plain(t["ja"]), t["ko"], t["same"][1:], tp[t["same"]]["ko"]))
        else:
            L.append("- %s (%s) → 틀 + 블록 %s · %d자" % (plain(t["ja"]), t["ko"], "·".join(CIRC[int(b[1:]) - 1] for b in t["body"]), us[t["id"]]["n"]))
            for x in t["xs"]:
                m = (" 〔%s — 보기예요. 내 사실로 바꿔 씀〕" % STN[x["st"]]) if x.get("st", "ok") != "ok" else ""
                L.append("  - 답하는 문장 보기: %s (%s)%s" % (plain(x["ja"]), x["ko"], m))
    L.append("")

    # 손으로 쓸 낱말
    ws = {}
    for k, v in C["words"].items():
        ws.setdefault(v["w"], v)
    L.append("## 손으로 쓸 낱말 %d개 (작문에 나오는 한자·가타카나)\n" % len(ws))
    L.append(" · ".join("%s(%s)" % (w, v["r"]) for w, v in ws.items()))
    L.append("")
    out = os.path.join(ROOT, "review", "문장.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(out, len("\n".join(L)), "자 · 문장", n[0])


if __name__ == "__main__":
    main()
