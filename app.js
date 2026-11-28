/* 작문·면접 드릴 — 앱. 자료는 data.js(window.DATA), 진도는 이 브라우저(localStorage)에 저장. */
(function () {
"use strict";
const D = window.DATA;
const KEY = "sakubun-v5";   // 5판(11/28): 내용이 통째로 바뀌어서 진도 기록을 새로 시작
const app = document.getElementById("app");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const U = {}, W = {}, SE = D.sents;
D.units.forEach(u => { U[u.id] = u; });
D.words.forEach(w => { W[w.id] = w; });
const BLOCKS = D.units.filter(u => u.kind === "b");
const QS = D.qs || [], QI = {}, QKIDS = {}, UNS = D.unseen || [], UNI = {}, VOC = D.voc || {};
const QM = QS.filter(q => q.rel !== "var");   // 세는 질문 = 큰 질문 + 이어지는 꼬리 질문. 바꿔 묻는 말(≈)은 세지 않고 글로만 보여 줌
QS.forEach(q => { QI[q.id] = q; if (q.par) (QKIDS[q.par] = QKIDS[q.par] || []).push(q.id); });
/* 질문 묶음: 나올 확률이 높은 순서. 묶음 하나 = 큰 질문 + 거기서 이어지는 꼬리 질문 (c.q = 세는 질문만) */
const QCH = D.qch || [], CHI = {};
QCH.forEach((c, i) => { c.no = i + 1; CHI[c.k] = c; c.q = c.ids.map(id => QI[id]).filter(q => q && q.rel !== "var"); });
const chOf = q => CHI[q.ch] || {no: 0, ko: "", q: []};
const chLabel = q => { const c = chOf(q); return c.no ? c.no + ". " + c.ko : ""; };
UNS.forEach(t => { UNI[t.id] = t; });
const FRU = D.units.filter(u => u.fr)[0] || null;   // 처음 보는 주제용 틀을 외우는 단위
const CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
const OFF = [1, 3, 7];
const ESSAY_MS = 30 * 60 * 1000;

/* ---------- 날짜 (하루는 새벽 4시에 바뀜) ---------- */
const pad = n => (n < 10 ? "0" : "") + n;
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
function now() { let t = null; try { t = localStorage.getItem("sakubun-now"); } catch (e) {} return t ? new Date(t) : new Date(); }
function today() { const d = now(); d.setHours(d.getHours() - 4); return ymd(d); }
const dt = s => new Date(s + "T12:00:00");
function addDays(s, n) { const d = dt(s); d.setDate(d.getDate() + n); return ymd(d); }
const diffDays = (a, b) => Math.round((dt(b) - dt(a)) / 86400000);
const WD = "일월화수목금토";
const dayLabel = s => { const d = dt(s); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + WD[d.getDay()] + "요일"; };
const md = s => { const d = dt(s); return (d.getMonth() + 1) + "/" + d.getDate(); };

/* ---------- 진도 ---------- */
function fresh() { return {v: 1, plan: {}, u: {}, s: {}, w: {}, q: {}, fx: {}, sess: null, log: {essay: [], mock: [], asm: [], un: []}, set: {furi: true, rate: 1, auto: true, qv: "k"}}; }
function load() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1) { const f = fresh(); Object.assign(f, o); f.set = Object.assign(fresh().set, o.set || {}); f.log = Object.assign(fresh().log, o.log || {}); return f; } } catch (e) {}
  return fresh();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------- 이름 ---------- */
function utitle(u) {
  const c = "";
  if (u.kind === "b") return "블록 " + CIRC[u.no - 1] + " " + u.ko + c;
  if (u.kind === "t") return (u.fr ? "" : "주제 " + u.no + " · ") + u.ko + c;
  if (u.kind === "i") return "면접 · " + u.ko + c;
  return u.ko;
}
const stName = st => (st === "pend" ? "답을 기다리는 초안" : "뜻 확인");
const kindName = {b: "블록", t: "주제", i: "면접 답", e: "인사·비상"};

/* ---------- 과정: 날짜표(D.days)대로. 밀린 것은 남은 날에 나눠 넣음 ---------- */
const urec = id => S.u[id] || {st: "new"};
const isDone = id => urec(id).st === "done";
const remainingUnits = () => D.order.filter(id => !isDone(id));
const DAYS = Object.keys(D.days).sort();
const LAST = DAYS[DAYS.length - 1];
const dayRow = d => D.days[d] || {};
const KINDS = ["b", "t", "i", "e", "w"];
function phase(d) { return d < D.start ? "before" : d === D.exam ? "exam" : d > D.exam ? "after" : "on"; }
const isRest = d => phase(d) === "on" && !D.days[d];   // 과정 안이지만 날짜표에 없는 날 = 일정을 비운 날(출국 날)
const restName = d => (D.rest && D.rest[d]) || "";
const planned = (k, d) => dayRow(d)[k] || 0;
function cumPlanned(k, d) { let n = 0; DAYS.forEach(x => { if (x <= d) n += planned(k, x); }); return n; }
function doneCount(k) { return k === "w" ? D.words.filter(w => S.w[w.id]).length : D.units.filter(u => u.kind === k && isDone(u.id)).length; }
const lastNewDay = DAYS.filter(d => ["b", "t", "i", "e"].some(k => planned(k, d) > 0)).pop() || LAST;
const firstTopicDay = DAYS.filter(d => planned("t", d) > 0)[0];
const ENDS = {};   // 종류마다 '여기까지는 끝나야 하는 날'들: 표에서 그 종류가 이어지는 구간의 마지막 날 → 새 것이 끝나는 날 → 마지막 날
KINDS.forEach(k => {
  const out = [];
  DAYS.forEach((d, i) => { if (planned(k, d) > 0 && !(DAYS[i + 1] && planned(k, DAYS[i + 1]) > 0)) out.push(d); });
  if (k === "b" && firstTopicDay) out.push(addDays(firstTopicDay, -1));
  out.push(lastNewDay, LAST);
  ENDS[k] = out.filter((x, i, a) => a.indexOf(x) === i).sort();
});
// 밀린 것을 넣어도 되는 날: 블록은 아무 날이나(주제가 블록을 쓰므로), 나머지는 '복습만' 날을 빼고. 새 것이 끝나는 날을 넘겼으면 남은 날 전부.
const allowedDay = (k, d) => d >= D.start && d <= LAST && (k === "b" || dayRow(d).only !== "rev" || d > lastNewDay);
function quotaK(k, d) {
  if (d < D.start || d > LAST) return 0;
  const prev = cumPlanned(k, addDays(d, -1)), done = doneCount(k);
  const base = Math.max(0, planned(k, d) - Math.max(0, done - prev));   // 미리 해 둔 만큼은 뺌
  const backlog = Math.max(0, prev - done);
  if (!backlog || !allowedDay(k, d)) return base;
  const end = ENDS[k].filter(x => x >= d)[0] || LAST;
  let n = 0;
  for (let x = d; x <= end; x = addDays(x, 1)) if (allowedDay(k, x)) n++;
  return base + Math.ceil(backlog / Math.max(1, n));
}
function newUnitsFor(d) {
  let out = [];
  ["b", "t", "i", "e"].forEach(k => { const q = quotaK(k, d); if (q > 0) out = out.concat(D.order.filter(id => U[id].kind === k && !isDone(id)).slice(0, q)); });
  return out.sort((a, b) => D.order.indexOf(a) - D.order.indexOf(b));
}
function newWordsFor(d) { const q = quotaK("w", d); return q > 0 ? D.worder.filter(id => !S.w[id]).slice(0, q) : []; }
function extraCount(key, d, cap) {   // 통째 쓰기·면접 모의: 표의 횟수 + 앞에서 못 한 것(하루 상한 cap)
  const P = planned(key, d);
  if (!P) return 0;
  return Math.min(cap, P + Math.max(0, cumPlanned(key, addDays(d, -1)) - S.log[key].length));
}
const blocksDone = () => BLOCKS.every(u => isDone(u.id));
const topicsReady = () => D.units.filter(u => u.kind === "t" && isDone(u.id) && u.blocks.length > 0 && u.blocks.every(isDone));   // 만능 작문(틀)도 들어감
/* 예상 질문: 질문마다 연결된 답(외운 문장 a.s 또는 짧은 답 a.sa). S.q[id] = {n 해 본 횟수, ok 마지막 결과, m 막힌 횟수, d 날짜} */
const unitsOfQ = q => q.a.filter(a => a.u).map(a => a.u);
const qKnown = q => unitsOfQ(q).every(isDone);              // 연결된 답을 다 외웠는지
const qrec = id => S.q[id] || {n: 0};
const qTried = () => QM.filter(q => qrec(q.id).n > 0).length;
const qStuck = () => QS.filter(q => qrec(q.id).n > 0 && !qrec(q.id).ok);
const qau = q => (S.set.qv === "k" && q.auk ? q.auk : q.au);   // 질문 목소리(설정): 나나미 / 게이타
const ansSids = q => { let o = []; q.a.forEach(a => { if (a.s) o = o.concat(a.s); }); return o; };
const ansClips = q => { let o = []; q.a.forEach(a => { o = o.concat(a.sa ? [a.sa.au] : a.s.map(s => SE[s].au)); }); return o; };
const mockChains = () => QCH.filter(c => !c.proc && unitsOfQ(QI[c.main]).length > 0 && qKnown(QI[c.main]));   // 면접 모의에 낼 수 있는 묶음(큰 질문의 답을 외운 것)
const mockPool = () => mockChains().map(c => QI[c.main]);
const unReady = () => !!FRU && isDone(FRU.id) && blocksDone() && UNS.length > 0;
const unOk = t => !t.same || (isDone(t.same) && U[t.same].blocks.every(isDone));   // 같은 글로 쓰는 주제는 그 주제를 외운 뒤에
function qQuota(d) {   // 오늘 훑을 질문 수: 표의 누적 수까지(밀린 것 포함, 하루 60개까지)
  if (!planned("q", d)) return 0;
  return Math.max(0, Math.min(60, cumPlanned("q", d) - qTried(), QM.length - qTried()));
}
function markQ(id, ok) {
  const d = today(), r = S.q[id] || (S.q[id] = {n: 0, m: 0});
  r.n++; r.ok = ok ? 1 : 0; r.d = d;
  if (!ok) { r.m = (r.m || 0) + 1; ansSids(QI[id]).forEach(sid => { const x = S.s[sid] || (S.s[sid] = {m: 0}); x.m++; x.x = addDays(d, 1); }); }
}
function pickQs(n, onlyStuck) {   // 묶음 순서(나올 확률이 높은 것부터)로 큰 질문 → 이어지는 꼬리 질문. 답을 외운 것부터, 모자라면 막혔던 것 → 아직 안 외운 것
  if (onlyStuck) return qStuck().slice(0, n).map(q => q.id);
  let out = [];
  QCH.forEach(c => {
    const m = QI[c.main];
    if (out.length >= n || (!qKnown(m) && !qrec(m.id).n)) return;   // 큰 질문의 답을 아직 안 외운 묶음은 뒤로
    c.q.forEach(q => { if (out.length < n && !qrec(q.id).n && qKnown(q)) out.push(q.id); });
  });
  if (out.length < n) out = out.concat(qStuck().filter(q => out.indexOf(q.id) < 0).slice(0, n - out.length).map(q => q.id));
  if (out.length < n) out = out.concat(QM.filter(q => !qrec(q.id).n && out.indexOf(q.id) < 0).slice(0, n - out.length).map(q => q.id));
  return out;
}
const frTopic = () => { const c = UNS.filter(t => !t.same); return c.length ? shuffle(c.slice())[0].id : ""; };   // 만능 작문 연습에 내놓을 '준비 안 한 주제'
function pickUnseen() {
  const pool = UNS.filter(unOk);
  if (!pool.length) return null;
  const cnt = {}, lastOk = {};
  S.log.un.forEach(x => { cnt[x.t] = (cnt[x.t] || 0) + 1; lastOk[x.t] = x.ok; });
  const min = Math.min.apply(null, pool.map(t => cnt[t.id] || 0));
  if (min > 0) { const stuck = pool.filter(t => lastOk[t.id] === 0); if (stuck.length) return shuffle(stuck)[0]; }
  const c = pool.filter(t => (cnt[t.id] || 0) === min), fr = c.filter(t => !t.same);
  return shuffle(fr.length ? fr : c)[0];   // 틀로 쓰는 주제를 먼저
}
function planFor(d) {
  if (S.plan[d]) return S.plan[d];
  const P = {new: newUnitsFor(d), words: newWordsFor(d), essay: extraCount("essay", d, 6), mock: extraCount("mock", d, 4), un: extraCount("un", d, 5), q: qQuota(d), q0: qTried(), rev: 0, rs: 0};
  if (d >= D.start && d <= D.exam) { S.plan[d] = P; save(); }
  return P;
}
const logCount = (k, d) => S.log[k].filter(x => x.d === d).length;

/* ---------- 복습할 것 ---------- */
function dueUnits(d) {
  return D.order.map(id => U[id]).filter(u => { const r = S.u[u.id]; return r && r.st === "done" && r.due && r.due <= d; })
    .sort((a, b) => (S.u[a.id].due < S.u[b.id].due ? -1 : S.u[a.id].due > S.u[b.id].due ? 1 : 0));
}
// 블록: 다음 날은 말로(가볍게), 3일 뒤·7일 뒤는 손으로. 주제: 손으로. 면접 답: 말로 → 질문 듣고 답하기.
function reviewSteps(u, k, light) {
  const g = "rev:" + u.id, st = "복습";
  const rec = mode => u.s.map(s => ({t: "recall", s: s, mode: mode, g: g, st: st}));
  const spk = [{t: "speak", u: u.id, g: g, st: st}];
  if (u.kind === "b") return light ? spk : k === 0 ? rec("say").concat(spk) : rec("write");
  if (u.kind === "t") return rec(light ? "say" : "write");
  if (u.kind === "i") return light || k > 0 ? spk : rec("say");
  return rec("say");
}
// 전체 복습 — 끝낸 단위를 전부 한 번씩(write = 손으로). 블록만 돌릴 때도 씀.
function sweepSteps(u, write, g, label) {
  const st = label || "전체 복습", rc = (s, mode) => ({t: "recall", s: s, mode: mode, g: g, st: st});
  if (u.kind === "b") return u.s.map(s => rc(s, write ? "write" : "say"));
  if (u.kind === "t") return (u.fr ? [] : [{t: "pick", u: u.id, sel: [], g: g, st: st}]).concat(u.s.map((s, i) => rc(s, write && i === 0 ? "write" : "say")));
  if (u.kind === "i") return [{t: "speak", u: u.id, g: g, st: st}];
  return u.s.map(s => rc(s, "say"));
}
function buildReview(d) {
  const row = dayRow(d), P = planFor(d), exam = phase(d) === "exam" || isRest(d);   // 시험 날·비운 날: 원할 때만 말로 가볍게
  const light = !!row.light || exam, sweep = !!(row.full || row.last), sw = P.sw || {};
  let left = (row.rev != null ? row.rev : exam ? 20 : 45) * 60 - (P.rs || 0);
  let steps = [];
  const covered = {};
  const put = (arr, force) => { const s = sumSec(arr); if (!force && s > left) return false; steps = steps.concat(arr); left -= s; return true; };
  const due = dueUnits(d);
  if (sweep) {
    const isDue = {}; due.forEach(u => { isDue[u.id] = 1; });
    D.order.map(id => U[id]).filter(u => isDone(u.id) && !sw[u.id]).sort((a, b) => "btie".indexOf(a.kind) - "btie".indexOf(b.kind))
      .forEach(u => { if (put(sweepSteps(u, !!row.full, (isDue[u.id] ? "rev:" : "lt:") + u.id))) covered[u.id] = 1; });
  } else {
    due.forEach(u => { if (put(reviewSteps(u, S.u[u.id].k || 0, light), !steps.length && !P.rs)) covered[u.id] = 1; });
    // 블록을 전부 손으로 다시 쓰는 날(12/6~12/8): 위에서 안 나온 블록을 더함
    if (row.blocks) BLOCKS.forEach(u => { if (isDone(u.id) && !covered[u.id] && !sw[u.id] && put(sweepSteps(u, true, "lt:" + u.id, "블록 다시 쓰기"))) covered[u.id] = 1; });
  }
  if (light && !P.lt) {
    if (!sweep) BLOCKS.forEach(u => { if (isDone(u.id) && !covered[u.id] && put([{t: "speak", u: u.id, g: "lt:" + u.id, st: "복습"}])) covered[u.id] = 1; });
    Object.keys(S.s).filter(id => SE[id] && S.s[id].m > 0 && !covered[SE[id].u] && isDone(SE[id].u))
      .sort((a, b) => S.s[b].m - S.s[a].m).slice(0, 12).forEach(id => { put([{t: "recall", s: id, mode: "say", g: "x:" + id, st: "복습"}]); });
  } else if (!light) {
    Object.keys(S.s).filter(id => SE[id] && S.s[id].x && S.s[id].x <= d && !covered[SE[id].u]).forEach(id => {
      put([{t: "recall", s: id, mode: U[SE[id].u].kind === "i" || U[SE[id].u].kind === "e" ? "say" : "write", g: "x:" + id, st: "복습"}]);
    });
  }
  const nSent = steps.length;
  D.worder.map(id => W[id]).filter(w => { const r = S.w[w.id]; return r && r.due && r.due <= d; }).slice(0, light ? 12 : 40)
    .forEach(w => { put([{t: "hw", w: w.id, ph: 1, g: "w:" + w.id, st: "글자 복습"}]); });
  return {steps: steps, nSent: nSent, nWord: steps.length - nSent};
}

/* ---------- 연습 한 판(세션) 만들기 ---------- */
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function scramble(n) { const id = Array.from({length: n}, (_, i) => i); if (n < 2) return id; for (let k = 0; k < 20; k++) { const p = shuffle(id); if (p.some((v, i) => v !== i)) return p; } return id.reverse(); }
function unitSteps(u, free) {
  const g = free ? "free:" + u.id : "unit:" + u.id;
  let steps = [{t: "view", u: u.id, g: g, st: "보기"}];
  let cl = [];
  u.s.forEach(s => SE[s].cloze.forEach((c, i) => cl.push({t: "cloze", s: s, c: i, o: shuffle([0, 1, 2, 3]), g: g, st: "빈칸"})));
  steps = steps.concat(shuffle(cl));
  u.s.forEach(s => { if (SE[s].chunks.length >= 3) steps.push({t: "order", s: s, perm: scramble(SE[s].chunks.length), built: [], g: g, st: "어순"}); });
  const say = u.kind === "i" || u.kind === "e";
  u.s.forEach(s => steps.push({t: "recall", s: s, mode: say ? "say" : "write", g: g, st: say ? "말하기" : "손으로 쓰기"}));
  if (u.q) steps.push({t: "speak", u: u.id, g: g, st: "말하기"});
  if (u.kind === "t" && !u.fr) steps.push({t: "pick", u: u.id, sel: [], g: g, st: "블록 고르기"});
  return steps;
}
function makeSession(kind, id, title, steps) {
  const groups = {};
  steps.forEach(s => { if (s.g) groups[s.g] = (groups[s.g] || 0) + 1; });
  steps.push({t: "done"});
  return {kind: kind, id: id || "", title: title, steps: steps, pos: 0, groups: groups, d: today(), n1: 0, ok1: 0, missed: []};
}
function pickTopic(logKey) {
  const pool = topicsReady();
  if (!pool.length) return null;
  const cnt = {}, lastOk = {};
  S.log[logKey].forEach(x => { cnt[x.t] = (cnt[x.t] || 0) + 1; lastOk[x.t] = x.ok; });
  const min = Math.min.apply(null, pool.map(u => cnt[u.id] || 0));
  // 안 써 본 주제부터. 다 한 번씩 썼으면 '막혔음'으로 끝난 주제를 먼저 다시.
  if (min > 0 && logKey === "essay") { const stuck = pool.filter(u => lastOk[u.id] === 0); if (stuck.length) return shuffle(stuck)[0]; }
  return shuffle(pool.filter(u => (cnt[u.id] || 0) === min))[0];
}
// 복습이 길면 30분쯤씩 나눠서 한 판씩(단위 중간에서는 안 끊음)
const BATCH = 1800;
function cutBatch(steps, maxSec) {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += stepSec(steps[i]);
    if (acc >= maxSec && i + 1 < steps.length && steps[i + 1].g !== steps[i].g) return steps.slice(0, i + 1);
  }
  return steps;
}
function reviewPart(d) {   // 지금 할 복습 한 판
  const P = planFor(d), r = buildReview(d), rem = Math.max(1, (P.rn || 1) - (P.rb || 0));
  return rem > 1 ? cutBatch(r.steps, sumSec(r.steps) / rem) : r.steps;
}
function buildSession(task) {
  if (task.t === "review") { const d = today(); return makeSession("review", "", dayRow(d).full ? "전체 복습" : "복습", reviewPart(d)); }
  if (task.t === "unit") { const u = U[task.id]; return makeSession("unit", u.id, utitle(u), unitSteps(u, task.free)); }
  if (task.t === "words") {
    const ws = planFor(today()).words.filter(id => !S.w[id]);
    return makeSession("words", "", "쓸 글자", ws.map(w => ({t: "hw", w: w, ph: 0, isNew: 1, g: "wn:" + w, st: "쓸 글자"})));
  }
  if (task.t === "asm") {
    const u = task.id ? U[task.id] : pickTopic("asm"); if (!u) return null;
    const g = "asm:" + u.id;
    return makeSession("asm", u.id, "조립 드릴 · " + u.ko, [
      {t: "pick", u: u.id, sel: [], g: g, st: "블록 고르기"},
      {t: "recall", s: u.s[0], mode: "write", g: g, st: "첫 문장"},
      {t: "essay", u: u.id, timed: 0, el: 0, g: g, st: "통째 쓰기", un: u.fr ? frTopic() : ""}]);
  }
  if (task.t === "essay") {
    const u = task.id ? U[task.id] : pickTopic("essay"); if (!u) return null;
    return makeSession("essay", u.id, "통째 쓰기 · " + u.ko, [{t: "essay", u: u.id, timed: 1, el: 0, g: "essay:" + u.id, st: "통째 쓰기", un: u.fr ? frTopic() : ""}]);
  }
  if (task.t === "mock") {
    const seq = mockSeq(); if (!seq) return null;
    const steps = seq.map((id, i) => ({t: "mockq", q: id, k: i + 1, n: seq.length, g: "mock", st: "질문"}));
    steps.push({t: "mockend", qs: seq, flag: {}, g: "mock", st: "돌아보기"});
    return makeSession("mock", "", "면접 모의", steps);
  }
  if (task.t === "qs") {
    const ids = task.ids || pickQs(task.n || 10, task.stuck);
    if (!ids.length) return null;
    return makeSession("qs", "", task.title || (task.stuck ? "막힌 질문" : "예상 질문"), ids.map((id, i) => ({t: "qa", q: id, k: i + 1, n: ids.length, g: "qa:" + id, st: "질문"})));
  }
  if (task.t === "un") {
    if (!unReady()) return null;
    const t = task.id ? UNI[task.id] : pickUnseen(); if (!t) return null;
    return makeSession("un", t.id, "처음 보는 주제", [{t: "unseen", n: t.id, g: "un:" + t.id, st: "처음 보는 주제"}]);
  }
  return null;
}
/* 면접 모의: 묶음 3개(거의 확실한 것 2 + 그 밖 1) × (큰 질문 + 이어지는 꼬리 질문 1~2개) + 마지막 '질문 있습니까'.
   안 해 본 것·막혔던 것 먼저. 큰 질문은 가끔 바꿔 묻는 말로 나옴. */
function mockSeq() {
  const pool = mockChains();
  if (pool.length < 3) return null;
  const sc = {};
  pool.forEach(c => { const r = qrec(c.main); sc[c.k] = (r.n ? (r.ok ? 2 : 1) : 0) + Math.random() * 1.4; });
  const sorted = pool.slice().sort((a, b) => sc[a.k] - sc[b.k]);
  const pick = sorted.filter(c => c.cat === "A").slice(0, 2);
  const rest = sorted.filter(c => pick.indexOf(c) < 0), other = rest.filter(c => c.cat === "B")[0];
  if (other && Math.random() < 0.6) pick.push(other);
  rest.forEach(c => { if (pick.length < 3 && pick.indexOf(c) < 0) pick.push(c); });
  const seq = [];
  shuffle(pick).forEach((c, i) => {
    const m = QI[c.main], vars = (QKIDS[m.id] || []).map(id => QI[id]).filter(k => k.rel === "var" && qKnown(k));
    seq.push(vars.length && Math.random() < 0.3 ? shuffle(vars)[0].id : m.id);
    const fus = c.q.filter(q => q.rel === "fu" && qKnown(q));
    shuffle(fus.slice()).slice(0, i === 0 ? 2 : 1).sort((a, b) => c.q.indexOf(a) - c.q.indexOf(b)).forEach(q => seq.push(q.id));   // 꼬리 질문은 묶음 안의 순서대로
  });
  const last = QM.filter(q => /質問はありますか/.test(q.plain) && qKnown(q))[0];
  if (last) seq.push(last.id);
  return seq;
}

/* ---------- 오늘 할 것 ---------- */
const SEC = {view: 25, hwNew: 70, hw: 25, cloze: 20, order: 35, write: 90, say: 25, speak: 45, pick: 20, mockq: 40, mockend: 90, qa: 40, unseen: 240};
const QBATCH = 10;   // 예상 질문은 10개씩 한 판
function stepSec(s) {
  if (s.t === "view") return SEC.view * U[s.u].s.length;
  if (s.t === "hw") return s.isNew ? SEC.hwNew : SEC.hw;
  if (s.t === "recall") return s.mode === "write" ? SEC.write : SEC.say;
  if (s.t === "essay") return s.timed ? 1800 : 600;
  return SEC[s.t] || 0;
}
const sumSec = steps => steps.reduce((a, s) => a + stepSec(s), 0);
function durText(sec) { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? "약 " + m + "분" : "약 " + Math.floor(m / 60) + "시간" + (m % 60 ? " " + (m % 60) + "분" : ""); }
function tasks(d) {
  const P = planFor(d), out = [];
  if (phase(d) === "exam" || isRest(d)) return out;   // 시험 날·비운 날에는 시키는 것이 없음(홈에서 원하면 말로 훑어보기)
  const rv = buildReview(d), total = sumSec(rv.steps), rb = P.rb || 0;
  if (P.rn == null) { P.rn = !rv.steps.length ? 0 : total <= 2400 ? 1 : Math.ceil(total / BATCH); if (S.plan[d]) save(); }
  const rn = Math.max(P.rn, rb + (rv.steps.length ? 1 : 0)), revs = [];
  const part = rv.steps.length ? reviewPart(d) : [], nw = part.filter(x => x.t === "hw").length;
  for (let i = 0; i < rn; i++) {
    const done = i < rb || !rv.steps.length, isNext = !done && i === rb;
    revs.push({t: "review", done: done, title: (dayRow(d).full ? "전체 복습" : "복습") + (rn > 1 ? " " + (i + 1) + "/" + rn : ""),
      sub: isNext ? "문장 " + (part.length - nw) + (nw ? " · 글자 " + nw : "") : "", sec: done ? 0 : isNext ? sumSec(part) : (total - sumSec(part)) / Math.max(1, rn - rb - 1)});
  }
  const words = [], units = [], essays = [], mocks = [];
  if (P.words && P.words.length) { const lw = P.words.filter(id => !S.w[id]); words.push({t: "words", done: !lw.length, title: "쓸 글자 " + P.words.length + "개", sub: "새로", sec: lw.length * SEC.hwNew}); }
  P.new.forEach(id => { const u = U[id]; units.push({t: "unit", id: id, done: isDone(id), title: utitle(u), sub: "새로", sec: isDone(id) ? 0 : sumSec(unitSteps(u))}); });
  const ready = topicsReady().length > 0;
  for (let i = 0; i < P.essay; i++) essays.push({t: "essay", done: i < logCount("essay", d), title: "통째 쓰기 " + (P.essay > 1 ? (i + 1) + "편째" : "1편"), sub: "30분 · 종이에 400자", sec: 1800, off: !ready});
  for (let i = 0; i < P.mock; i++) mocks.push({t: "mock", done: i < logCount("mock", d), title: "면접 모의" + (P.mock > 1 ? " " + (i + 1) + "번째" : ""), sub: "큰 질문 3개와 이어지는 질문", sec: 420, off: mockChains().length < 3});
  // 예상 질문 훑기: 10개씩 한 판. 해 본 질문 수로 끝났는지 봄
  const qts = [], uns = [];
  if (P.q) {
    const got = qTried() - (P.q0 || 0), nT = Math.ceil(P.q / QBATCH), all = qTried() >= QM.length;
    for (let i = 0; i < nT; i++) {
      const upto = Math.min(P.q, (i + 1) * QBATCH), n = upto - i * QBATCH;
      qts.push({t: "qs", n: n, done: all || got >= upto, title: "예상 질문 " + n + "개" + (nT > 1 ? " (" + (i + 1) + "/" + nT + ")" : ""), sub: "나올 확률이 높은 것부터 · 이어지는 질문까지", sec: n * SEC.qa});
    }
  }
  for (let i = 0; i < (P.un || 0); i++) uns.push({t: "un", done: i < logCount("un", d), title: "처음 보는 주제" + (P.un > 1 ? " " + (i + 1) + "번째" : ""), sub: "조립 연습", sec: SEC.unseen, off: !unReady()});
  // 순서: 복습 첫 판 → 쓸 글자 → 새 단위 → 예상 질문 → (통째 쓰기와 남은 복습을 번갈아) → 처음 보는 주제 → 면접 모의
  const mix = [];
  for (let i = 0; i < Math.max(essays.length, revs.length - 1); i++) { if (essays[i]) mix.push(essays[i]); if (revs[i + 1]) mix.push(revs[i + 1]); }
  return revs.slice(0, 1).concat(words, units, qts, mix, uns, mocks);
}
const nextTask = d => tasks(d).filter(t => !t.done && !t.off)[0] || null;
function liveSess() {
  const s = S.sess;
  if (!s || s.fin) return null;
  if (s.kind === "review" && s.d !== today()) return null;
  return s;
}

/* ---------- 음성 ---------- */
const AU = {el: new Audio(), cache: {}, token: 0, cancel: null, ok: false};
const clipUrl = h => "audio/" + h + ".mp3";
/* 미리 보기 카드용 음성 묶음: D.pk = {i: {클립 이름: [묶음 번호, 시작, 길이]}} 가 있으면 audio/p<번호>.mp3 에서 잘라 씀.
   (카드 하나에 파일을 512개까지만 올릴 수 있어서 묶음. 사이트 판에는 D.pk 가 없고 클립마다 파일이 따로 있음.) */
const PKB = {};
function packBuf(k) {
  return PKB[k] || (PKB[k] = fetch("audio/p" + k + ".mp3").then(r => { if (!r.ok) throw new Error("no pack"); return r.arrayBuffer(); }).catch(e => { delete PKB[k]; throw e; }));
}
function blobUrl(h) {
  if (AU.cache[h]) return Promise.resolve(AU.cache[h]);
  if (D.pk) {
    const x = D.pk.i[h];
    if (!x) return Promise.reject(new Error("no clip"));
    return packBuf(x[0]).then(b => (AU.cache[h] = URL.createObjectURL(new Blob([b.slice(x[1], x[1] + x[2])], {type: "audio/mpeg"}))));
  }
  return fetch(clipUrl(h)).then(r => { if (!r.ok) throw new Error("no clip"); return r.blob(); }).then(b => (AU.cache[h] = URL.createObjectURL(b)));
}
function preload(list) { (list || []).forEach(h => { if (h) blobUrl(h).catch(() => {}); }); }
function stopAudio() { AU.token++; try { AU.el.pause(); } catch (e) {} if (AU.cancel) AU.cancel(); }
function play(list) {
  stopAudio();
  const tk = AU.token;
  let p = Promise.resolve();
  (list || []).filter(Boolean).forEach((h, i) => {
    p = p.then(() => tk !== AU.token ? null : blobUrl(h).then(u => {
      if (tk !== AU.token) return null;
      return new Promise(res => {
        const done = () => { AU.el.onended = AU.el.onerror = null; AU.cancel = null; res(); };
        AU.cancel = done;
        AU.el.onended = () => setTimeout(done, 280);
        AU.el.onerror = done;
        AU.el.src = u;
        AU.el.playbackRate = S.set.rate || 1;
        const pr = AU.el.play();
        if (pr && pr.catch) pr.catch(done);
      });
    }).catch(() => null));
  });
  return p;
}
function unlockAudio() {
  if (AU.ok) return;
  AU.ok = true;
  try {
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    AU.el.src = URL.createObjectURL(new Blob([buf], {type: "audio/wav"}));
    const pr = AU.el.play();
    if (pr && pr.catch) pr.catch(() => {});
  } catch (e) {}
}
document.addEventListener("pointerdown", unlockAudio, {once: true, capture: true});
const playBtn = (list, label) => '<button class="play' + (label ? " txt" : "") + '" data-act="play" data-au="' + list.join(",") + '" aria-label="듣기">' + (label ? "▶ " + label : "▶") + "</button>";
function allClips() {   // 설정에서 고른 질문 목소리 것만
  const s = {};
  Object.keys(SE).forEach(k => { s[SE[k].au] = 1; });
  D.units.forEach(u => { if (u.q) s[qau(u.q)] = 1; });
  QS.forEach(q => { s[qau(q)] = 1; q.a.forEach(a => { if (a.sa) s[a.sa.au] = 1; }); });
  return Object.keys(s);
}

/* ---------- 그리기: 공통 ---------- */
function furiClass() { document.body.classList.toggle("nofuri", !S.set.furi); }
function dchip() {
  if (!D.exam) return "";
  const k = diffDays(today(), D.exam);
  return '<span class="dchip">' + (k > 0 ? "D-" + k : k === 0 ? "D-DAY" : "") + "</span>";
}
const furiBtn = () => '<button class="tbtn fz" data-act="furi" aria-pressed="' + !!S.set.furi + '" aria-label="후리가나 켜고 끄기">あ</button>';
function topHome(back) {
  return '<header class="top">' + (back ? '<a class="tbtn" href="#/">← 홈</a>' : '<a class="brand" href="#/">작문·면접</a>') +
    '<span class="top-sp"></span>' + dchip() + furiBtn() + (back ? "" : '<a class="tbtn" href="#/list">목록</a>') + "</header>";
}
function sentRow(sid, noRole, voc) {
  const s = SE[sid], tags = [];
  const tag = s.when || (noRole ? "" : s.role);
  if (tag) tags.push(esc(tag));
  if (s.o) tags.push("원서에 쓴 문장");
  if (s.st) tags.push('<span class="chk">' + stName(s.st) + "</span>");
  return '<div class="sent">' + (tags.length ? '<span class="role">' + tags.join(" · ") + "</span>" : "") +
    '<div class="row"><p class="jmid ja">' + s.html + "</p>" + playBtn([s.au]) + '</div><p class="kr">' + esc(s.ko) + "</p>" + (voc ? vocHtml(s) : "") + "</div>";
}
function vocHtml(s) {   // 단어장(bjt-words)에 있는 낱말: 누르면 읽기와 뜻
  const ids = (s.voc || []).filter(id => VOC[id]);
  if (!ids.length) return "";
  return '<div class="voc"><span class="vl">단어장</span>' + ids.map(id => '<button class="vc ja" data-act="voc" data-v="' + id + '" aria-pressed="false">' + esc(VOC[id].w) + "</button>").join("") + '<span class="vd"></span></div>';
}
function saRow(sa) {
  return '<div class="sent"><span class="role">짧은 답' + (sa.st ? ' · <span class="chk">' + stName(sa.st) + "</span>" : "") + '</span><div class="row"><p class="jmid ja">' + sa.html + "</p>" + playBtn([sa.au]) +
    '</div><p class="kr">' + esc(sa.ko) + "</p></div>";
}
const ansHtml = q => q.a.map(a => (a.sa ? saRow(a.sa) : a.s.map(s => sentRow(s, true)).join(""))).join("");
const catName = c => { const x = (D.qcats || []).filter(y => y[0] === c)[0]; return x ? x[1] : c; };
const qtags = q => (q.core ? " · 꼭 나오는 질문" : "") + (q.rel === "fu" ? " · 이어지는 질문" : q.rel === "var" ? " · 바꿔 묻는 말" : "") + (q.hard ? " · 압박 질문" : "") + (q.chk ? " · 뜻 확인" : "");
const qstat = id => { const r = qrec(id); return r.n ? (r.ok ? "답했음" : "막혔음") : "아직"; };
function unseenHtml(t) {   // 처음 보는 주제의 모범 글. 밑줄 = 주제에 답하는 두 문장(그 자리에서 짓는 부분)
  if (t.same) return essayHtml(U[t.same]);
  let body = t.x.map(x => '<span class="xs">' + x.html + "</span>").join("") + SE[t.br].html;
  t.body.forEach(it => { body += U[it.b].s.map(s => SE[s].html).join(""); });
  return '<div class="essay">' + [SE[t.f].html, body, SE[t.l].html].map(p => '<p class="ja">' + p + "</p>").join("") + "</div>";
}
function unseenPlan(t) {
  if (t.same) return "<li>" + esc(utitle(U[t.same])) + "과 같은 글로 써요.</li><li>" + esc(comboText(U[t.same])) + "</li>";
  return "<li>만능 작문의 첫 문장 → 주제에 답하는 문장 " + t.x.length + "개 → 연결 문장 " + (t.brn === 2 ? "②" : "①") + " → " + t.blocks.map(b => "블록 " + CIRC[U[b].no - 1]).join(" → ") + " → 끝 문장</li>" +
    t.x.map((x, i) => "<li>답하는 문장 " + (i + 1) + ": " + esc(x.ko) + (x.st ? ' <span class="chk">(보기예요. 내 사실로 바꿔 써요)</span>' : "") + "</li>").join("");
}
function essayParas(u) {
  let body = "";
  u.body.forEach(it => { body += it.b ? U[it.b].s.map(s => SE[s].html).join("") : SE[it.s].html; });
  return [SE[u.s[0]].html, body, SE[u.s[u.s.length - 1]].html];
}
const essayHtml = u => '<div class="essay">' + essayParas(u).map(p => '<p class="ja">' + p + "</p>").join("") + "</div>";
function comboText(u) {
  const parts = [];
  let x = 0;
  u.body.forEach(it => { if (it.b) { if (x) { parts.push("전용 문장 " + x + "개"); x = 0; } parts.push("블록 " + CIRC[U[it.b].no - 1]); } else x++; });
  if (x) parts.push("전용 문장 " + x + "개");
  return "첫 문장 → " + parts.join(" → ") + " → 끝 문장";
}
function strokeFig(ch) {
  const ds = D.strokes[ch];
  if (!ds) return "";
  let g = '<line x1="54.5" y1="4" x2="54.5" y2="105"/><line x1="4" y1="54.5" x2="105" y2="54.5"/>';
  ds.forEach((d, i) => {
    g += '<path d="' + d + '"/>';
    const m = /^M\s*([\d.]+)[ ,]+([\d.]+)/i.exec(d);
    if (m) g += '<text x="' + (Math.max(4, +m[1] - 6)).toFixed(1) + '" y="' + (Math.max(8, +m[2] - 1)).toFixed(1) + '">' + (i + 1) + "</text>";
  });
  return '<figure><svg viewBox="0 0 109 109" data-act="strokes" role="img" aria-label="' + ch + ' 획순">' + g + "</svg><figcaption>" + ds.length + "획 · 누르면 순서대로</figcaption></figure>";
}
function wordModel(w) {
  return '<div class="glyph ja">' + esc(w.w) + '</div><p class="gread ja">' + esc(w.r) + '</p><p class="ko sub">' + esc(w.ko) + "</p>" +
    '<div class="kvg">' + w.chars.map(strokeFig).join("") + "</div>" +
    (SE[w.ex] ? '<p class="hint">이 문장에 나와요</p><p class="jmid ja">' + SE[w.ex].html + "</p>" : "");
}
let toastT = 0;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- 그리기: 홈 ---------- */
function meterHtml() {
  const c = k => { const a = D.units.filter(u => u.kind === k); return a.filter(u => isDone(u.id)).length + " / " + a.length; };
  return '<div class="meter m5"><div><b>' + c("b") + "</b><span>블록</span></div><div><b>" + c("t") + "</b><span>주제</span></div><div><b>" + c("i") +
    "</b><span>면접 답</span></div><div><b>" + D.words.filter(w => S.w[w.id]).length + " / " + D.words.length + "</b><span>손으로 쓸 낱말</span></div>" +
    (QM.length ? '<div><b>' + qTried() + " / " + QM.length + '</b><span><a href="#/q">예상 질문</a></span></div>' : "") + "</div>";
}
const factCount = () => Object.keys(SE).filter(k => SE[k].st && !SE[k].ref).length + QS.reduce((n, q) => n + q.a.filter(a => a.sa && a.sa.st).length, 0);
function factNote() {
  const n = factCount();
  return n ? '<p class="small" style="margin-top:14px">내 답을 일본어로 옮긴 문장이 ' + n + '개 있어요. <a href="#/fact">뜻이 내 말과 같은지 보기</a></p>' : "";
}
const kindCount = ids => { const c = {}; ids.forEach(id => { const k = U[id].kind; c[k] = (c[k] || 0) + 1; }); return c; };
function rowText(row) {   // 날짜표 한 줄을 말로
  const p = [];
  if (row.b) p.push("새 블록 " + row.b);
  if (row.t) p.push("주제 " + row.t);
  if (row.i) p.push("면접 답 " + row.i);
  if (row.e) p.push("인사·비상");
  if (row.w) p.push("쓸 글자 " + row.w);
  if (row.q) p.push("예상 질문 " + row.q);
  if (row.essay) p.push("통째 쓰기 " + row.essay + "편");
  if (row.un) p.push("처음 보는 주제 " + row.un);
  if (row.mock) p.push("면접 모의" + (row.mock > 1 ? " " + row.mock + "번" : ""));
  if (row.blocks) p.push("블록 전부 손으로");
  if (row.full) p.push("전체 복습");
  if (!p.length || row.only === "rev" && !row.full) p.push("복습만");
  return p.join(" · ");
}
const minText = m => (m >= 60 ? Math.floor(m / 60) + "시간" + (m % 60 ? " " + (m % 60) + "분" : "") : m + "분");
function tableHtml(d) {
  let h = '<ol class="tasks dates" style="margin-top:24px">';
  for (let x = D.start; x < D.exam; x = addDays(x, 1)) {
    const row = D.days[x];
    h += '<li class="' + (x < d ? "done" : x === d ? "now" : "") + '"><span class="tn">' + md(x) + '</span><span class="tt">' + esc(row ? rowText(row) : "없음" + (restName(x) ? "(" + restName(x) + ")" : "")) +
      '</span><span class="ts">' + (row ? minText(row.min) : "") + "</span></li>";
  }
  return h + '<li><span class="tn">' + md(D.exam) + '</span><span class="tt">시험</span><span class="ts"></span></li></ol>';
}
function tomorrowText(d) {
  const t = addDays(d, 1);
  if (t === D.exam) return "내일은 시험 날이에요.";
  if (t > D.exam) return "";
  if (!D.days[t]) return "내일은 할 것이 없어요" + (restName(t) ? "(" + restName(t) + ")" : "") + "." + (addDays(t, 1) === D.exam ? " 모레가 시험 날이에요." : "");
  const c = kindCount(newUnitsFor(t)), row = dayRow(t), p = [];
  if (c.b) p.push("새 블록 " + c.b + "개");
  if (c.t) p.push("주제 " + c.t + "개");
  if (c.i) p.push("면접 답 " + c.i + "개");
  if (c.e) p.push("인사·비상 문장");
  if (row.q) p.push("예상 질문 " + row.q + "개");
  if (row.essay) p.push("통째 쓰기 " + row.essay + "편");
  if (row.mock) p.push("면접 모의 " + row.mock + "번");
  p.push(row.full ? "전체 복습" : "복습");
  return "내일: " + p.join(" · ");
}
const NAV = '<nav class="links"><a class="btn ghost" href="#/q">예상 질문 전체</a><a class="btn ghost" href="#/list">전체 목록</a><a class="btn ghost" href="#/words">글자 목록</a><a class="btn ghost" href="#/plan">날짜별 분량</a><a class="btn ghost" href="#/free">자유 연습</a>' +
  '<a class="btn ghost" href="#/log">기록</a><a class="btn ghost" href="#/exam">시험 날 볼 것</a><a class="btn ghost" href="#/set">설정</a></nav>';
// 미리 보기 판(D.notes.preview)에서만: 시작 전에도 날짜를 바꿔 가며 화면을 볼 수 있게. 실제 판에는 안 나옴.
const PV = !!(D.notes && D.notes.preview);
function fakeNow() { try { return localStorage.getItem("sakubun-now"); } catch (e) { return null; } }
function bannerHtml() {
  if (!D.notes || !D.notes.banner) return "";
  let h = '<div class="small" style="margin:-12px 0 22px;padding:10px 12px;background:var(--soft)">' + esc(D.notes.banner);
  if (PV) h += '<div style="margin-top:8px">' + (fakeNow() ? "지금 <b>" + md(today()) + "</b>로 보는 중 · " + '<button class="btn ghost" data-act="pv-day">하루 뒤로</button> <button class="btn ghost" data-act="pv-end">미리 보기 끝내기(기록 지움)</button>' :
    '<button class="btn ghost" data-act="pv-go">첫날(' + md(D.start) + ') 화면 미리 해 보기</button>') + "</div>";
  return h + "</div>";
}
function showHome() {
  const d = today(), ph = phase(d);
  if (S.sess && S.sess.fin) { S.sess = null; save(); }
  let h = topHome(false) + '<main class="wrap">' + bannerHtml();
  const live = liveSess();
  if (ph === "before" && !live) {
    h += '<section class="today"><p class="eyebrow">' + dayLabel(d) + " · 시험까지 " + diffDays(d, D.exam) + "일</p>" +
      "<h1>" + dayLabel(D.start) + '에 시작해요</h1><p class="lede">그때까지는 할 것이 없어요. 시작하는 날 여기에 그날 할 것이 떠요.<br>처음엔 하루 30분, 뒤로 갈수록 늘어나요.</p></section>' +
      factNote() + '<h2 class="sec-h">날짜별 분량</h2>' + tableHtml(d).replace(' style="margin-top:24px"', "") + NAV + "</main>";
    app.innerHTML = h;
    checkVersion();
    return;
  }
  if (ph === "after" && !live) {
    h += '<section class="today"><p class="eyebrow">' + dayLabel(d) + '</p><h1>과정이 끝났어요</h1><p class="lede">문장은 전체 목록과 자유 연습에서 계속 볼 수 있어요.</p></section>' +
      '<h2 class="sec-h">진도 <span class="small">전체 ' + D.units.filter(u => isDone(u.id)).length + " / " + D.units.length + "</span></h2>" + meterHtml() + NAV + "</main>";
    app.innerHTML = h;
    return;
  }
  const T = tasks(d), nx = nextTask(d);
  const left = T.filter(t => !t.done && !t.off).reduce((a, t) => a + t.sec, 0);
  const none = !D.units.some(u => isDone(u.id)) && !D.words.some(w => S.w[w.id]);
  h += '<section class="today"><p class="eyebrow">' + dayLabel(d) + (ph === "on" ? " · " + (diffDays(D.start, d) + 1) + "일차" : "") + (ph === "exam" ? " · 시험 날" : ph === "on" ? " · 시험까지 " + diffDays(d, D.exam) + "일" : "") + "</p>";
  if (live) {
    h += "<h1>" + esc(live.title) + '</h1><p class="t-sub">하던 것이 있어요 · ' + (live.pos + 1) + " / " + (live.steps.length - 1) + "</p>" +
      '<button class="btn primary wide" data-act="resume">이어서 하기</button>';
  } else if (nx) {
    h += "<h1>" + esc(nx.title) + '</h1><p class="t-sub">' + esc(nx.sub ? nx.sub + " · " : "") + durText(nx.sec) + "</p>" +
      (none ? '<p class="lede tip">종이와 펜을 옆에 두고 시작하세요. 손으로 쓰고, 소리 내어 말해요.</p>' : "") +
      '<button class="btn primary wide" data-act="next">시작</button>';
  } else {
    const rest = isRest(d), more = ph === "on" && !rest && remainingUnits().length && dayRow(d).only !== "rev";
    const warm = (ph === "exam" || rest) && buildReview(d).steps.length ? '<button class="btn wide" data-act="warm" style="margin-top:10px">말로 한 번 훑어보기 · ' + durText(sumSec(buildReview(d).steps)) + "</button>" : "";
    h += "<h1>" + (ph === "exam" ? "오늘은 시험 날이에요" : rest ? "오늘은 할 것이 없어요" : "오늘 할 것을 다 했어요") + '</h1><p class="t-sub">' +
      (ph === "exam" ? "한자가 안 떠오르면 히라가나로 쓰고 멈추지 마세요." : rest ? (restName(d) ? restName(d) + " 날이라 비워 뒀어요. " : "") + (addDays(d, 1) === D.exam ? "내일은 시험 날이에요." : "") : tomorrowText(d)) + "</p>" +
      (ph === "exam" ? '<a class="btn primary wide" href="#/exam">시험 가는 길에 볼 것</a>' + warm : rest ? warm :
        more ? '<button class="btn wide" data-act="more">내일 것 미리 하기</button>' : "");
  }
  h += "</section>";
  if (T.length) {
    h += '<h2 class="sec-h">오늘 할 것 <span class="small">' + (left ? "남은 것 " + durText(left) : "끝") + "</span></h2><ol class=\"tasks\">";
    let seenNow = false;
    T.forEach((t, i) => {
      const isNow = !t.done && !t.off && !seenNow; if (isNow) seenNow = true;
      h += '<li class="' + (t.done ? "done" : isNow ? "now" : "") + '"><span class="tn">' + (i + 1) + '</span><span class="tt">' + esc(t.title) +
        '</span><span class="ts">' + (t.done ? "✓" : t.off ? "아직 잠김" : esc(t.sub || "")) + "</span></li>";
    });
    h += "</ol>";
  }
  h += '<h2 class="sec-h">진도 <span class="small">전체 ' + D.units.filter(u => isDone(u.id)).length + " / " + D.units.length + "</span></h2>" + meterHtml() + factNote() + NAV + "</main>";
  app.innerHTML = h;
  checkVersion();
}

/* ---------- 그리기: 연습 화면 ---------- */
let tick = 0;
function stageBar(sess) {
  const names = [];
  sess.steps.forEach(s => { if (s.st && names.indexOf(s.st) < 0) names.push(s.st); });
  if (names.length < 2) return "";
  const cur = sess.steps[sess.pos].st, ci = names.indexOf(cur);
  return '<div class="stages">' + names.map((n, i) => '<span class="' + (i === ci ? "on" : i < ci || ci < 0 ? "past" : "") + '">' + esc(n) + "</span>").join("") + "</div>";
}
const bar = inner => '<footer class="bar"><div class="bar-in">' + inner + "</div></footer>";
const B = (act, label, cls, attrs) => '<button class="btn ' + (cls || "") + '" data-act="' + act + '"' + (attrs || "") + ">" + label + "</button>";

const V = {};
V.view = function (st) {
  const u = U[st.u];
  let h = "";
  if (u.fr) {
    h += '<p class="eyebrow">준비한 주제가 안 나왔을 때</p><h2>' + esc(u.ko) + '</h2><ul class="plan3"><li>아무것도 못 짓겠으면 이대로 써요: ' + esc(comboText(u)) + " (" + u.n + "자)</li>" +
      "<li>첫 문장의 「このテーマ」 자리에는, 시험지에 적힌 주제를 그대로 옮겨 써도 돼요.</li>" +
      "<li>주제에 답하는 문장을 한두 개 지을 수 있으면, 첫 문장 다음에 쓰고 연결 문장을 붙여요(내 생각을 썼으면 ①, 사실이나 일상을 썼으면 ②). 그러면 블록 ⑤는 빼요.</li>" +
      "<li>좋은 점과 나쁜 점이 있는 주제인데 문장이 안 떠오르면, '의견' 문장을 그대로 써요.</li></ul><p class=\"inst\" style=\"margin-top:18px\">만능 작문의 문장 " + u.s.length + "개를 외워요.</p>";
  } else if (u.kind === "t") {
    h += '<p class="eyebrow">작문 주제</p><h2 class="ja">' + u.ja + '</h2><p class="ko sub">' + esc(u.ko) + "</p>" +
      '<ul class="plan3"><li>' + esc(comboText(u)) + "</li><li>조립하면 " + u.n + "자 · 원고지 " + u.rows + "줄</li></ul><p class=\"inst\" style=\"margin-top:18px\">이 주제의 첫 문장과 끝 문장" + (u.s.length > 2 ? ", 전용 문장" : "") + "을 외워요.</p>";
  } else if (u.q) {
    h += '<div class="qbox"><p class="eyebrow">면접에서는 이렇게 물어요</p><div class="sent" style="border:0;padding:0"><div class="row"><p class="jmid ja">' + u.q.html + "</p>" + playBtn([qau(u.q)]) +
      '</div><p class="kr">' + esc(u.q.ko) + "</p></div></div>";
  } else {
    h += '<p class="inst">짧은 말이에요. 상황과 같이 외워요.</p>';
  }
  h += u.s.map(s => sentRow(s, false, true)).join("");
  if (u.kind === "t" && u.body.length) h += '<details style="margin-top:18px"><summary class="small">' + (u.fr ? "만능 작문 전체 글 보기" : "조립한 전체 글 보기") + "</summary>" + essayHtml(u) + "</details>";
  preload(u.s.map(s => SE[s].au));
  return {body: h, bar: playBtn(u.s.map(s => SE[s].au), "전체 듣기").replace('class="play txt"', 'class="btn narrow"') + B("pass", "다음", "primary")};
};
V.hw = function (st) {
  const w = W[st.w];
  if (st.ph === 0) return {body: '<p class="inst">종이에 3번 따라 쓰세요. 네모를 누르면 획순이 보여요.</p>' + wordModel(w), bar: B("hw-next", "이미 쓸 수 있어요", "narrow") + B("hw-next", "3번 썼어요", "primary")};
  if (st.ph === 1) return {
    body: '<p class="inst">안 보고 종이에 쓰세요.</p><p class="gread ja" style="font-size:32px;color:var(--ink)">' + esc(w.r) + '</p><p class="ko sub">' + esc(w.ko) + '</p><div class="cover" style="margin-top:22px">쓴 뒤에 정답 보기</div>',
    bar: B("hw-next", "정답 보기", "primary")};
  return {body: '<p class="inst">쓴 것과 비교하세요.</p>' + wordModel(w), bar: B("ng", "틀림", "ng") + B("ok", "맞음", "primary")};
};
V.cloze = function (st) {
  const s = SE[st.s], c = s.cloze[st.c], picked = st.pick != null;
  let h = '<p class="inst">빈칸에 들어갈 말을 고르세요.</p><p class="jbig ja">' + c.pre + '<span class="blank' + (picked ? " fill" : "") + '">' + (picked ? c.opts[0] : "　") + "</span>" + c.post +
    '</p><p class="ko sub">' + esc(s.ko) + '</p><div class="opts">' +
    st.o.map(i => '<button class="opt ja' + (picked ? (i === 0 ? " ok" : i === st.pick ? " bad" : " dim") : "") + '" data-act="opt" data-i="' + i + '"' + (picked ? " disabled" : "") + ">" + c.opts[i] + "</button>").join("") + "</div>";
  if (picked) h += '<div class="fb"><span class="mark' + (st.pick === 0 ? "" : " bad") + '">' + (st.pick === 0 ? "○ 정답" : "✕ 오답") + "</span>" + playBtn([s.au], "문장 듣기") + "</div>";
  return {body: h, bar: picked ? B("next", "다음", "primary") : ""};
};
V.order = function (st) {
  const s = SE[st.s], ch = s.chunks;
  const chip = (i, act) => '<button class="chip ja" data-act="' + act + '" data-i="' + i + '"' + (st.chk ? " disabled" : "") + ">" + ch[i].h + "</button>";
  let h = '<p class="inst">조각을 순서대로 눌러 문장을 만드세요.</p><p class="ko">' + esc(s.ko) + '</p><div class="built">' + st.built.map(i => chip(i, "chip-del")).join("") +
    '</div><div class="pool">' + st.perm.filter(i => st.built.indexOf(i) < 0).map(i => chip(i, "chip-add")).join("") + "</div>";
  if (st.chk) {
    h += '<div class="fb"><span class="mark' + (st.res ? "" : " bad") + '">' + (st.res ? "○ 정답" : "✕ 오답") + "</span>" + playBtn([s.au], "문장 듣기") + '<p class="jmid ja" style="margin-top:10px">' + s.html + "</p></div>";
    return {body: h, bar: B("next", "다음", "primary")};
  }
  return {body: h, bar: B("o-clear", "다시", "narrow") + B("o-check", "확인", "primary", st.built.length === ch.length ? "" : " disabled")};
};
V.recall = function (st) {
  const s = SE[st.s], wr = st.mode === "write";
  let h = '<p class="inst">' + (wr ? "한국어 뜻을 보고 종이에 일본어로 쓰세요." : "한국어 뜻을 보고 소리 내어 일본어로 말하세요.") + "</p>" +
    (s.when ? '<p class="eyebrow">' + esc(s.when) + "</p>" : "") + '<p class="ko">' + esc(s.ko) + "</p>";
  if (st.hint && !st.shown) h += '<p class="hint">첫머리</p><p class="jmid ja">' + (s.chunks.length ? s.chunks[0].h : esc(s.kana.slice(0, 4))) + "…</p>";
  if (!st.shown) return {body: h, bar: (st.hint ? "" : B("r-hint", "힌트", "narrow")) + B("r-show", "정답 보기", "primary")};
  h += '<div class="reveal"><p class="jbig ja">' + s.html + "</p>" + (wr ? '<p class="small" style="margin-top:10px">한자를 히라가나로 썼어도 문장이 맞으면 맞음이에요.</p>' : "") + "</div>";
  return {body: h, bar: playBtn([s.au]).replace('class="play"', 'class="btn narrow"') + B("ng", "틀림", "ng") + B("ok", "맞음", "primary")};
};
V.speak = function (st) {
  const u = U[st.u];
  let h = '<p class="inst">질문을 듣고 소리 내어 답하세요.</p><div class="qbox">' + playBtn([qau(u.q)], "질문 듣기") +
    (st.qshow || st.shown ? '<p class="jmid ja" style="margin-top:8px">' + u.q.html + '</p><p class="kr small">' + esc(u.q.ko) + "</p>" : ' <button class="btn ghost" data-act="q-show">질문 글자 보기</button>') + "</div>";
  if (!st.shown) return {body: h, bar: B("s-show", "정답 보기", "primary"), enter: [qau(u.q)]};
  h += '<p class="eyebrow">이렇게 답해요</p>' + u.say.map(s => sentRow(s, true)).join("");
  return {body: h, bar: playBtn(u.say.map(s => SE[s].au)).replace('class="play"', 'class="btn narrow"') + B("ng", "틀림", "ng") + B("ok", "맞음", "primary")};
};
V.pick = function (st) {
  const u = U[st.u], need = u.blocks.length;
  let h = '<p class="inst">이 주제에 쓸 블록 ' + need + '개를 고르세요.</p><h2 class="ja">' + u.ja + '</h2><p class="ko sub">' + esc(u.ko) + '</p><div class="pick">' +
    BLOCKS.map(b => '<button class="pk' + (st.chk && u.blocks.indexOf(b.id) >= 0 ? " must" : "") + '" data-act="pk" data-b="' + b.id + '" aria-pressed="' + (st.sel.indexOf(b.id) >= 0) + '"' + (st.chk ? " disabled" : "") + ">" + CIRC[b.no - 1] + " " + esc(b.ko) + "</button>").join("") + "</div>";
  if (st.chk) {
    h += '<div class="fb"><span class="mark' + (st.res ? "" : " bad") + '">' + (st.res ? "○ 정답" : "✕ 오답") + '</span><p style="margin-top:8px">' + esc(comboText(u)) + "</p></div>";
    return {body: h, bar: B("next", "다음", "primary")};
  }
  return {body: h, bar: B("p-check", "확인", "primary", st.sel.length === need ? "" : " disabled")};
};
function essayElapsed(st) { return (st.el || 0) + (st.run ? Date.now() - st.t0 : 0); }
function clock(ms) { const neg = ms < 0; ms = Math.abs(ms); const s = Math.floor(ms / 1000); return (neg ? "+" : "") + pad(Math.floor(s / 60)) + ":" + pad(s % 60); }
V.essay = function (st) {
  const u = U[st.u], ut = u.fr && st.un ? UNI[st.un] : null;   // 만능 작문은 '준비 안 한 주제' 하나를 내놓고 쓰게 함
  let h = '<p class="eyebrow">' + (u.fr ? "만능 작문 · " : "") + (st.timed ? "통째 쓰기 · 30분 · 종이에 400자" : "통째 쓰기 · 시간은 재지 않아요") + '</p><h2 class="ja">' + (ut ? ut.ja : u.ja) + '</h2><p class="ko sub">' +
    esc(ut ? ut.ko + " — 준비 안 한 주제가 나왔다고 생각하고 써요" : u.ko) + "</p>";
  if (!st.shown) {
    if (st.timed) h += '<p class="timer num" id="clock" style="margin-top:22px">' + clock(ESSAY_MS - essayElapsed(st)) + "</p>";
    h += '<ul class="plan3" style="margin-top:18px">' + (u.fr ? "<li>1. 첫 문장: 「このテーマ」 자리에 위의 주제를 그대로 옮겨 써도 돼요. 줄을 바꿔요.</li><li>2. 주제에 대한 내 생각을 한두 문장 지을 수 있으면 쓰고, 연결 문장을 붙여요. (그러면 블록 ⑤는 빼요)</li>" +
      "<li>3. 못 짓겠으면 바로 블록 ② → ① → ⑤.</li><li>4. 줄을 바꾸고 끝 문장.</li>" : "<li>1. 첫 문장: 주제에 바로 답하고 줄을 바꿔요.</li><li>2. 블록을 이어서 써요.</li><li>3. 줄을 바꾸고 끝 문장.</li>") +
      "<li>한자가 안 떠오르면 히라가나로 쓰고 멈추지 않아요.</li></ul>";
    if (!st.timed) return {body: h, bar: B("e-done", "다 썼어요 · 모범 글 보기", "primary")};
    if (!st.run && !st.el) return {body: h, bar: B("e-start", "시작", "primary")};
    return {body: h, bar: B(st.run ? "e-pause" : "e-start", st.run ? "잠깐 멈춤" : "이어서", "narrow") + B("e-done", "다 썼어요", "primary"), clock: st.run};
  }
  h += (st.timed ? '<p class="small" style="margin-top:14px">걸린 시간 ' + clock(st.el || 0) + "</p>" : "") + '<p class="eyebrow" style="margin-top:20px">모범 글 · ' + u.n + "자 · " + esc(comboText(u)) + "</p>" + essayHtml(u) +
    (ut ? '<details style="margin-top:14px"><summary class="small">이 주제에 맞춰 두 문장을 지어 쓴 글 보기</summary><ul class="plan3">' + unseenPlan(ut) + "</ul>" + unseenHtml(ut) + "</details>" : "") +
    '<ul class="checks"><li>끝 문장까지 썼나요?</li><li>글자 수가 360자쯤 되나요? (20자 × 18줄)</li><li>블록을 빠뜨리지 않았나요?</li></ul>';
  return {body: h, bar: B("ng", "막혔음", "ng") + B("ok", "끝까지 씀", "primary")};
};
V.mockq = function (st) {
  const q = QI[st.q];
  return {body: '<p class="eyebrow">면접 모의 · 질문 ' + st.k + " / " + st.n + '</p><p class="inst">질문을 듣고 소리 내어 답하세요. 한 번에 20초 안쪽으로. 답은 마지막에 한꺼번에 봐요.</p>' + playBtn([qau(q)], "질문 다시 듣기"),
    bar: B("pass", st.k === st.n ? "답했어요 · 돌아보기" : "답했어요 · 다음 질문", "primary"), enter: [qau(q)]};
};
V.mockend = function (st) {
  let h = '<p class="inst">막힌 질문에 표시하세요. 표시한 것은 내일 복습에 다시 나와요.</p>';
  st.qs.forEach(id => {
    const q = QI[id];
    h += '<div class="sent"><span class="role">' + esc(chLabel(q)) + qtags(q) + '</span><div class="row"><p class="jmid ja">' + q.html + "</p>" + playBtn([qau(q)]) + '</div><p class="kr">' + esc(q.ko) + "</p>" +
      q.a.map(a => (a.sa ? [a.sa.html] : a.s.map(s => SE[s].html)).map(x => '<p class="jmid ja" style="font-size:19px;margin-top:6px">' + x + "</p>").join("")).join("") +
      '<button class="btn ' + (st.flag[id] ? "ng" : "ghost") + '" data-act="m-flag" data-u="' + id + '" style="margin-top:8px">' + (st.flag[id] ? "✕ 막혔음" : "막혔으면 누르기") + "</button></div>";
  });
  return {body: h, bar: B("m-fin", "끝내기", "primary")};
};
V.qa = function (st) {
  const q = QI[st.q];
  let h = '<p class="eyebrow">예상 질문 ' + st.k + " / " + st.n + " · " + esc(chLabel(q)) + qtags(q) + '</p><p class="inst">질문을 듣고 소리 내어 답하세요. 20초 안쪽으로.</p><div class="qbox">' + playBtn([qau(q)], "질문 듣기") +
    (st.qshow || st.shown ? '<p class="jmid ja" style="margin-top:8px">' + q.html + '</p><p class="kr small">' + esc(q.ko) + "</p>" : ' <button class="btn ghost" data-act="q-show">질문 글자 보기</button>') + "</div>";
  if (!st.shown) return {body: h, bar: B("qa-show", "답 보기", "primary"), enter: [qau(q)]};
  h += '<p class="eyebrow">이렇게 답해요</p>' + ansHtml(q) + (q.note ? '<p class="hint">' + esc(q.note) + "</p>" : "");
  return {body: h, bar: playBtn(ansClips(q)).replace('class="play"', 'class="btn narrow"') + B("ng", "막혔음", "ng") + B("ok", "답했음", "primary")};
};
V.unseen = function (st) {
  const t = UNI[st.n];
  let h = '<p class="eyebrow">처음 보는 주제 · 조립 연습</p><h2 class="ja">' + t.ja + '</h2><p class="ko sub">' + esc(t.ko) + "</p>";
  if (!st.shown) {
    h += '<ul class="plan3" style="margin-top:18px"><li>1. 준비한 주제 ' + D.units.filter(x => x.kind === "t" && !x.fr).length + '개 가운데 같은 글로 쓸 수 있는 것이 있는지 먼저 생각해요.</li><li>2. 없으면 만능 작문으로: 첫 문장 → <b>주제에 답하는 문장 두 개를 종이에 지어 쓰기</b> → 연결 문장 → 블록 2개 → 끝 문장. (아무것도 못 짓겠으면 첫 문장 → 블록 ② → ① → ⑤ → 끝 문장)</li>' +
      "<li>3. 연결 문장은 내 생각을 썼으면 ①, 사실이나 일상을 썼으면 ②. 어느 블록 2개를 쓸지도 정해요.</li><li>주제의 낱말은 시험지를 보고 그대로 옮겨 써도 돼요. 손으로 안 외운 한자는 히라가나로 써도 돼요.</li><li>명소·추억처럼 패션과 먼 주제는, 주제에 답하는 문장을 서너 개 쓰고 연결 문장 ②로 넘어가요.</li></ul>";
    return {body: h, bar: B("un-show", "정했어요 · 모범 글 보기", "primary")};
  }
  h += '<p class="eyebrow" style="margin-top:20px">이렇게 쓸 수 있어요 · ' + t.n + '자</p><ul class="plan3">' + unseenPlan(t) + (t.tip ? "<li>" + esc(t.tip) + "</li>" : "") + "</ul>" + unseenHtml(t);
  return {body: h, bar: B("ng", "막혔음", "ng") + B("ok", "쓸 수 있었음", "primary")};
};
V.done = function (st, sess) {
  let h = '<p class="eyebrow">끝</p><h1>' + esc(sess.title) + "</h1>";
  if (sess.n1) h += '<p class="lede">처음에 바로 맞은 것 <b class="num">' + sess.ok1 + " / " + sess.n1 + "</b></p>";
  const ms = sess.missed.filter((x, i, a) => a.indexOf(x) === i && SE[x]);
  if (ms.length) h += '<h2 class="sec-h">틀렸던 문장 <span class="small">내일 복습에 다시 나와요</span></h2>' + ms.map(s => sentRow(s, true)).join("");
  const nx = nextTask(today());
  return {body: h, bar: B("home", "홈", "narrow") + (nx ? B("next", "다음: " + esc(nx.title), "primary") : B("home", "오늘 할 것 끝", "primary"))};
};

function showRun() {
  const sess = S.sess;
  if (!sess) { go("#/"); return; }
  clearInterval(tick);
  const st = sess.steps[sess.pos];
  if (st.t === "done" && !sess.fin) { sess.fin = true; if (sess.kind === "review") { const P = planFor(today()); P.rev = 1; P.lt = 1; P.rb = (P.rb || 0) + 1; } save(); }
  const v = V[st.t](st, sess);
  const total = sess.steps.length - 1;
  app.innerHTML = '<header class="top"><button class="tbtn" data-act="home">← 홈</button><span class="rtitle">' + esc(sess.title) + '</span><span class="top-sp"></span>' +
    (st.t === "done" ? "" : '<span class="dchip">' + (sess.pos + 1) + " / " + total + "</span>") + furiBtn() + "</header>" + stageBar(sess) +
    '<main class="wrap run" data-step="' + st.t + '">' + v.body + "</main>" + (v.bar ? bar(v.bar) : "");
  if (v.clock) tick = setInterval(() => { const el = document.getElementById("clock"); if (el) el.textContent = clock(ESSAY_MS - essayElapsed(st)); }, 500);
  if (v.enter && !st.entered) { st.entered = 1; save(); if (S.set.auto) play(v.enter); }
  const nx = sess.steps[sess.pos + 1];
  if (nx) preload(nx.s ? [SE[nx.s].au] : nx.q && QI[nx.q] ? [qau(QI[nx.q])] : nx.u && U[nx.u].q ? [qau(U[nx.u].q)] : []);
}

/* ---------- 채점·진행 ---------- */
const cur = () => S.sess.steps[S.sess.pos];
function resetStep(c) {
  delete c.res; delete c.pick; delete c.chk; delete c.shown; delete c.hint; delete c.qshow; delete c.entered;
  if (c.t === "order") { c.built = []; c.perm = scramble(SE[c.s].chunks.length); }
  if (c.t === "cloze") c.o = shuffle([0, 1, 2, 3]);
  if (c.t === "pick") c.sel = [];
  if (c.t === "hw") c.ph = c.isNew ? 0 : 1;
  if (c.t === "essay") { c.el = 0; c.run = 0; }
  return c;
}
function sidOf(st) { return st.s || null; }
function settle(ok) {
  const sess = S.sess, st = cur(), d = today();
  st.res = ok ? 1 : 0;
  const first = !st.retry;
  if (first && st.t !== "view" && st.t !== "mockq" && st.t !== "mockend") { sess.n1++; if (ok) sess.ok1++; }
  if (first && sess.kind === "review") { const P = planFor(d); P.rs = (P.rs || 0) + stepSec(st); }
  if (st.t === "qa" && first) { const r = S.q[st.q] || (S.q[st.q] = {n: 0, m: 0}); r.n++; r.ok = ok ? 1 : 0; r.d = d; if (!ok) r.m = (r.m || 0) + 1; }
  if (!ok) {
    const sids = st.t === "speak" ? U[st.u].say : st.t === "qa" ? ansSids(QI[st.q]) : sidOf(st) ? [sidOf(st)] : [];
    sids.forEach(id => { const r = S.s[id] || (S.s[id] = {m: 0}); r.m++; if (st.t === "recall" || st.t === "speak" || st.t === "qa") { r.x = addDays(d, 1); sess.missed.push(id); } });
    if (st.t === "hw") { const r = S.w[st.w]; if (r) { r.m = (r.m || 0) + 1; r.f = d; } }
    const c = resetStep(JSON.parse(JSON.stringify(st)));
    c.retry = (st.retry || 0) + 1;
    let end = sess.pos + 1;
    while (end < sess.steps.length && sess.steps[end].st === st.st && sess.steps[end].t !== "done") end++;
    sess.steps.splice(Math.min(sess.pos + 4, end), 0, c);
  } else {
    if (st.t === "hw") {
      const r = S.w[st.w];
      if (!r) S.w[st.w] = {i: d, k: 0, due: addDays(d, 1), m: 0};
      else if (st.g && st.g.indexOf("w:") === 0) {
        if (r.f === d) { r.due = addDays(d, 1); delete r.f; }
        else { r.k = (r.k || 0) + 1; r.due = r.k < OFF.length ? (addDays(r.i, OFF[r.k]) > d ? addDays(r.i, OFF[r.k]) : addDays(d, 1)) : null; }
      }
    }
    if (st.g && st.g.indexOf("x:") === 0) { const r = S.s[st.g.slice(2)]; if (r && first) delete r.x; }
    if (st.g && sess.groups[st.g] != null) {
      sess.groups[st.g]--;
      if (sess.groups[st.g] === 0) groupDone(st.g, sess);
    }
  }
  sess.pos++;
  save();
  showRun();
  window.scrollTo(0, 0);
}
function groupDone(g, sess) {
  const d = today(), k = g.split(":")[0], id = g.slice(k.length + 1);
  if (k === "unit" || k === "free") {
    if (!isDone(id)) S.u[id] = {st: "done", done: d, k: 0, due: addDays(d, 1)};
  } else if (k === "rev") {
    const r = S.u[id];
    r.k = (r.k || 0) + 1;
    r.due = r.k < OFF.length ? (addDays(r.done, OFF[r.k]) > d ? addDays(r.done, OFF[r.k]) : addDays(d, 1)) : null;
    const P = planFor(d); P.rev = 1; (P.sw = P.sw || {})[id] = 1;
  } else if (k === "asm") { S.log.asm.push({d: d, t: id, ok: cur().bad ? 0 : 1}); }
  else if (k === "essay") { const st = cur(); S.log.essay.push({d: d, t: id, sec: Math.round((st.el || 0) / 1000), ok: st.bad ? 0 : 1}); }
  else if (k === "mock") { S.log.mock.push({d: d, n: sess.n1 || 0, ok: sess.ok1 || 0}); }
  else if (k === "un") { S.log.un.push({d: d, t: id, ok: cur().bad ? 0 : 1}); }
  if (k === "lt") { const P = planFor(d); (P.sw = P.sw || {})[id] = 1; }
  if (k === "lt" || k === "x" || k === "w") planFor(d).rev = 1;
}

/* ---------- 그리기: 목록·낱말·설정 ---------- */
function unitStatus(u) {
  const r = urec(u.id);
  if (r.st !== "done") return "아직";
  return md(r.done) + " · 복습 " + Math.min(r.k || 0, 3) + "/3";
}
function showList() {
  let h = topHome(true) + '<main class="wrap"><h1>전체 목록</h1><p class="lede">누르면 문장을 볼 수 있어요.</p>';
  ["b", "t", "i", "e"].forEach(k => {
    const us = D.units.filter(u => u.kind === k);
    if (!us.length) return;
    h += '<h2 class="sec-h">' + kindName[k] + ' <span class="small">' + us.filter(u => isDone(u.id)).length + " / " + us.length + '</span></h2><div class="list">' +
      us.map(u => '<a class="rowl" href="#/u/' + u.id + '"><span class="tt">' + esc(utitle(u)) + '</span><span class="ts">' + unitStatus(u) + "</span></a>").join("") + "</div>";
  });
  app.innerHTML = h + "</main>";
}
function showUnit(id) {
  const u = U[id];
  if (!u) { go("#/list"); return; }
  let h = '<header class="top"><a class="tbtn" href="#/list">← 목록</a><span class="top-sp"></span>' + furiBtn() + '</header><main class="wrap"><p class="eyebrow">' + kindName[u.kind] + " · " + unitStatus(u) + "</p><h1>" + esc(utitle(u)) + "</h1>";
  if (u.kind === "t" && !u.fr) h += '<p class="lede ja" style="font-size:20px">' + u.ja + '</p><ul class="plan3"><li>' + esc(comboText(u)) + "</li><li>조립하면 " + u.n + "자 · 원고지 " + u.rows + "줄</li></ul>";
  if (u.fr) h += '<p class="lede">준비한 주제가 안 나왔을 때 쓰는 글이에요. 아무것도 못 짓겠으면 이대로 써요: ' + esc(comboText(u)) + " (" + u.n + "자 · 원고지 " + u.rows + "줄). 주제에 답하는 문장을 지을 수 있으면: 첫 문장 → 내가 지은 한두 문장 → 연결 문장(내 생각을 썼으면 ①, 사실이나 일상을 썼으면 ②) → 블록 2개 → 끝 문장.</p>";
  if (u.q) h += '<div class="qbox" style="margin-top:18px"><div class="sent" style="border:0;padding:0"><div class="row"><p class="jmid ja">' + u.q.html + "</p>" + playBtn([qau(u.q)]) + '</div><p class="kr">' + esc(u.q.ko) + "</p></div></div>";
  h += '<div style="margin-top:18px">' + u.s.map(s => sentRow(s, false, true)).join("") + "</div>";
  if (u.kind === "t" && u.body.length) h += '<h2 class="sec-h">' + (u.fr ? "만능 작문 · 이대로 쓰면 되는 글" : "조립한 전체 글") + "</h2>" + essayHtml(u);
  const qs = QS.filter(q => unitsOfQ(q).indexOf(u.id) >= 0);
  if (qs.length) h += '<h2 class="sec-h">이 문장으로 답하는 질문 <span class="small">' + qs.length + '개</span></h2><div class="list">' + qs.map(q => '<a class="rowl" href="#/q/' + q.id + '"><span class="tt">' + esc(q.ko) + '</span><span class="ts">' + qstat(q.id) + "</span></a>").join("") + "</div>";
  h += '<div style="margin-top:28px"><button class="btn wide" data-act="free" data-u="' + u.id + '">' + (isDone(u.id) ? "이 단위 다시 연습하기" : "이 단위 지금 하기") + "</button></div></main>";
  app.innerHTML = h;
}
function wordStatus(w) { const r = S.w[w.id]; return !r ? "아직" : r.due ? "복습 " + Math.min(r.k || 0, 3) + "/3" : "복습 끝"; }
function showWords() {
  let h = topHome(true) + '<main class="wrap"><h1>손으로 쓸 낱말</h1><p class="lede">한자·가타카나로 쓰는 낱말 ' + D.words.length + "개예요. 글에 많이 나오는 것부터 날마다 몇 개씩 연습해요. 나머지는 히라가나로 써도 돼요.</p>" +
    '<div class="list" style="margin-top:24px">' + D.worder.map(id => W[id]).map(w => '<a class="rowl" href="#/w/' + w.id + '"><span class="wj ja">' + esc(w.w) + '</span><span class="tt"><span class="ja">' + esc(w.r) + "</span> · " + esc(w.ko) +
    '</span><span class="ts">' + wordStatus(w) + "</span></a>").join("") + "</div></main>";
  app.innerHTML = h;
}
function showWord(id) {
  const w = W[id];
  if (!w) { go("#/words"); return; }
  app.innerHTML = '<header class="top"><a class="tbtn" href="#/words">← 낱말</a><span class="top-sp"></span>' + furiBtn() + '</header><main class="wrap">' + wordModel(w) + "</main>";
}
function showPlan() {
  app.innerHTML = topHome(true) + '<main class="wrap"><h1>날짜별 분량</h1><p class="lede">처음엔 조금, 뒤로 갈수록 많아져요. 빠뜨린 날의 것은 남은 날에 나눠서 들어가요.</p>' + tableHtml(today()) + "</main>";
}
function showFree() {
  const ready = topicsReady().length, mp = mockPool().length;
  let h = topHome(true) + '<main class="wrap"><h1>자유 연습</h1><p class="lede">날짜와 상관없이 더 하고 싶을 때 써요. 오늘 할 것에는 영향이 없어요.</p><div class="list" style="margin-top:24px">';
  h += '<button class="rowl" data-act="fr" data-k="asm"' + (ready ? "" : " disabled") + '><span class="tt">조립 드릴</span><span class="ts">' + (ready ? "주제 " + ready + "개 가능 · " + S.log.asm.length + "번 함" : "블록 8개와 주제를 하나 끝내면 열려요") + "</span></button>";
  h += '<button class="rowl" data-act="fr" data-k="essay"' + (ready ? "" : " disabled") + '><span class="tt">통째 쓰기 (30분)</span><span class="ts">' + (ready ? S.log.essay.length + "편 씀" : "블록 8개와 주제를 하나 끝내면 열려요") + "</span></button>";
  h += '<button class="rowl" data-act="fr" data-k="mock"' + (mp >= 5 ? "" : " disabled") + '><span class="tt">면접 모의 (질문 6~7개)</span><span class="ts">' + (mp >= 5 ? S.log.mock.length + "번 함" : "답을 외운 질문이 5개가 되면 열려요") + "</span></button>";
  h += '<button class="rowl" data-act="fr" data-k="un"' + (unReady() ? "" : " disabled") + '><span class="tt">처음 보는 주제 (조립 연습)</span><span class="ts">' + (unReady() ? "주제 " + UNS.length + "개 · " + S.log.un.length + "번 함" : "블록 8개와 틀을 끝내면 열려요") + "</span></button>";
  h += '<a class="rowl" href="#/q"><span class="tt">예상 질문 전체</span><span class="ts">' + qTried() + " / " + QM.length + "</span></a></div></main>";
  app.innerHTML = h;
}
function showExam() {
  const em = D.units.filter(u => u.kind === "e");
  let h = topHome(true) + '<main class="wrap"><p class="eyebrow">시험 날 볼 것</p><h1>세 가지만</h1><ul class="checks"><li>1. 작문은 첫 문장에서 주제에 바로 답해요. 그다음 블록, 마지막에 끝 문장.</li><li>2. 한자가 안 떠오르면 히라가나로 쓰고 멈추지 않아요.</li><li>3. 면접에서 못 알아들으면 다시 물어요. 아래 문장을 그대로 써요.</li></ul>';
  em.forEach(u => { h += '<h2 class="sec-h">' + esc(u.ko) + "</h2>" + u.s.map(s => sentRow(s)).join(""); });
  h += '<h2 class="sec-h">블록의 첫 문장</h2>' + BLOCKS.map(u => '<div class="sent"><span class="role">' + esc(utitle(u)) + '</span><div class="row"><p class="jmid ja">' + SE[u.s[0]].html + "</p>" + playBtn([SE[u.s[0]].au]) + "</div></div>").join("");
  app.innerHTML = h + "</main>";
}
function seg(act, cur, opts) { return '<span class="seg">' + opts.map(o => '<button data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + "</button>").join("") + "</span>"; }
function showSet() {
  let h = topHome(true) + '<main class="wrap"><h1>설정</h1><div class="set" style="margin-top:24px">' +
    '<div><span class="sl">후리가나</span>' + seg("set-furi", S.set.furi ? 1 : 0, [[1, "보임"], [0, "숨김"]]) + "</div>" +
    '<div><span class="sl">음성 속도</span>' + seg("set-rate", S.set.rate, [[0.85, "느리게"], [1, "보통"]]) + "</div>" +
    '<div><span class="sl">정답·질문을 열 때 자동으로 듣기</span>' + seg("set-auto", S.set.auto ? 1 : 0, [[1, "켬"], [0, "끔"]]) + "</div>" +
    '<div><span class="sl">면접관 질문 목소리<br><span class="small">답 문장은 언제나 나나미예요.</span></span>' + seg("set-qv", S.set.qv === "k" ? "k" : "n", [["n", "나나미"], ["k", "게이타"]]) + "</div>" +
    '<div><span class="sl">음성 전부 받아 두기<br><span class="small" id="dlmsg">인터넷이 없어도 소리가 나게 해요.</span></span><button class="btn" data-act="dl">받기</button></div>' +
    '<div><span class="sl">진도 옮기기<br><span class="small">다른 브라우저로 옮길 때 코드를 복사해서 붙여 넣어요.</span></span><button class="btn" data-act="exp">코드 만들기</button><button class="btn" data-act="imp">붙여 넣기</button><textarea id="code" hidden></textarea></div>' +
    '<div><span class="sl">처음부터 다시<br><span class="small">진도를 전부 지워요.</span></span><button class="btn ng" data-act="reset">초기화</button></div>' +
    '<div><span class="sl small">획순 자료: KanjiVG (© Ulrich Apel, CC BY-SA 3.0, kanjivg.tagaini.net)<br>음성: Microsoft Nanami · Keita · 단어장 낱말: 내 단어장(BJT 단어장)<br>판 ' + esc(D.stamp || "") + " · " + esc(D.ver || "") + "</span></div></div></main>";
  app.innerHTML = h;
}

/* ---------- 예상 질문 전체 ---------- */
function qcell(q) {   // 묶음 안에서: 큰 질문 = ●(거의 확실하면 ★), 이어지는 질문 = 1, 2, 3 …
  const r = qrec(q.id), k = chOf(q).q.indexOf(q);
  return '<a class="qc' + (r.n ? (r.ok ? " ok" : " ng") : "") + (q.par ? " sub" : " main") + (q.core ? " core" : "") + '" href="#/q/' + q.id + '" title="' + esc(q.ko) + '" aria-label="' + esc(q.ko) + " · " + qstat(q.id) + '">' + (k <= 0 ? (q.core ? "★" : "●") : k) + "</a>";
}
function chainBlock(c) {
  const done = c.q.filter(q => qrec(q.id).n).length;
  return '<section class="chain"><div class="chh"><b>' + c.no + ". " + esc(c.ko) + '</b><span class="small">' + done + " / " + c.q.length + '</span><button class="btn ghost chgo" data-act="ch-go" data-k="' + c.k + '">이어서 연습</button></div>' +
    '<p class="small">근거: ' + esc(c.ev) + '</p><div class="qgrid">' + c.q.map(qcell).join("") + "</div>" +
    '<details class="qlist"><summary class="small">질문을 글로 보기</summary><div class="list">' + c.ids.map(id => QI[id]).map(q => '<a class="rowl' + (q.par ? " sub" : "") + '" href="#/q/' + q.id + '"><span class="tt">' + (q.rel === "fu" ? "↳ " : q.rel === "var" ? "≈ " : "") + esc(q.ko) +
    '</span><span class="ts">' + (q.rel === "var" ? "바꿔 묻는 말" : qstat(q.id)) + "</span></a>").join("") + "</div></details></section>";
}
function showQ() {
  const tried = qTried(), ng = qStuck().length, ready = QM.filter(q => !qrec(q.id).n && qKnown(q)).length;
  let h = topHome(true) + '<main class="wrap"><h1>예상 질문 전체</h1><p class="lede">실제로 나올 확률이 높은 것부터 늘어놓았어요. 묶음 하나는 큰 질문과, 거기서 이어지는 꼬리 질문이에요. 질문 ' + QM.length + "개를 전부 한 번씩 답해 보는 것이 목표예요.</p>" +
    '<div class="meter" style="margin-top:20px;grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>' + tried + " / " + QM.length + "</b><span>해 본 질문</span></div><div><b>" + ng + "</b><span>막힌 질문</span></div><div><b>" + ready +
    "</b><span>답을 외웠고 아직 안 해 본 것</span></div></div>" +
    '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-act="qs-go" data-k="new"' + (tried < QM.length ? "" : " disabled") + ">안 해 본 질문 10개</button>" +
    '<button class="btn" data-act="qs-go" data-k="ng"' + (ng ? "" : " disabled") + ">막힌 질문만</button></div>" +
    '<p class="small" style="margin-top:14px">★·● = 묶음의 큰 질문 · 숫자 = 이어지는 꼬리 질문 · 검은 칸 = 답했음 · 빨간 테 = 막혔음 · 빈칸 = 아직</p>';
  (D.qcats || []).forEach(c => {
    const chs = QCH.filter(x => x.cat === c[0]), qs = QM.filter(q => q.cat === c[0]);
    if (!chs.length) return;
    h += '<h2 class="sec-h">' + esc(c[1]) + ' <span class="small">' + qs.filter(q => qrec(q.id).n).length + " / " + qs.length + "</span></h2>" + chs.map(chainBlock).join("");
  });
  app.innerHTML = h + "</main>";
}
let QV = {};
function showQOne(id) {
  const q = QI[id];
  if (!q) { go("#/q"); return; }
  if (QV.id !== id) QV = {id: id};
  const i = QS.indexOf(q), prev = QS[i - 1], next = QS[i + 1], r = qrec(id);
  let h = '<header class="top"><a class="tbtn" href="#/q">← 질문 전체</a><span class="top-sp"></span><span class="dchip">' + (i + 1) + " / " + QS.length + "</span>" + furiBtn() + '</header><main class="wrap run" data-step="qone"><p class="eyebrow">' +
    q.id + " · " + esc(chLabel(q)) + qtags(q) + " · " + (r.n ? qstat(id) + " (" + r.n + "번 해 봄)" : "아직 안 해 봄") + "</p>";
  if (q.par) h += '<p class="small" style="margin-bottom:10px">앞 질문: <a href="#/q/' + q.par + '">' + esc(QI[q.par].ko) + "</a></p>";
  h += '<div class="qbox">' + playBtn([qau(q)], "질문 듣기") + (QV.qshow || QV.shown ? '<p class="jmid ja" style="margin-top:8px">' + q.html + '</p><p class="kr small">' + esc(q.ko) + "</p>" : ' <button class="btn ghost" data-act="qv-q">질문 글자 보기</button>') + "</div>";
  let barh;
  if (!QV.shown) { h += '<p class="inst">질문을 듣고 소리 내어 답한 다음에 답을 보세요.</p>'; barh = B("qv-show", "답 보기", "primary"); }
  else {
    h += '<p class="eyebrow">이렇게 답해요</p>' + ansHtml(q) + (q.note ? '<p class="hint">' + esc(q.note) + "</p>" : "");
    const us = unitsOfQ(q).filter((x, k, a) => a.indexOf(x) === k);
    if (us.length) h += '<p class="small" style="margin-top:12px">이 답을 외우는 곳: ' + us.map(u => '<a href="#/u/' + u + '">' + esc(utitle(U[u])) + "</a>" + (isDone(u) ? "" : " (아직 안 외움)")).join(" · ") + "</p>";
    const kids = QKIDS[id] || [];
    if (kids.length) h += '<h2 class="sec-h">이어서 물을 수 있는 질문</h2><div class="list">' + kids.map(k => '<a class="rowl" href="#/q/' + k + '"><span class="tt">' + (QI[k].rel === "fu" ? "↳ " : "≈ ") + esc(QI[k].ko) + '</span><span class="ts">' + qstat(k) + "</span></a>").join("") + "</div>";
    barh = playBtn(ansClips(q)).replace('class="play"', 'class="btn narrow"') + B("qv-ng", "막혔음", "ng") + B("qv-ok", "답했음", "primary");
  }
  h += '<nav class="links" style="margin-top:28px">' + (prev ? '<a class="btn ghost" href="#/q/' + prev.id + '">← 앞 질문</a>' : "") + (next ? '<a class="btn ghost" href="#/q/' + next.id + '">다음 질문 →</a>' : "") + "</nav></main>" + bar(barh);
  app.innerHTML = h;
  if (!QV.entered) { QV.entered = 1; if (S.set.auto) play([qau(q)]); }
}

/* ---------- 사실 확인: 내가 채운 말이 들어간 문장을 한국어 뜻으로 보고, 다른 것만 누름 ---------- */
function factItems() {
  const out = [];
  D.order.forEach(uid => U[uid].s.forEach(sid => { const s = SE[sid]; if (s.st && !s.ref) out.push({id: sid, st: s.st, html: s.html, ko: s.ko, where: utitle(U[uid]).replace(" (확인 필요)", "")}); }));
  QS.forEach(q => q.a.forEach(a => { if (a.sa && a.sa.st) out.push({id: q.id + ".sa", st: a.sa.st, html: a.sa.html, ko: a.sa.ko, where: "질문: " + q.ko}); }));
  return out;
}
function showFact() {
  const items = factItems(), fx = S.fx || (S.fx = {});
  let h = topHome(true) + '<main class="wrap"><h1>뜻 확인</h1><p class="lede">내가 답한 말을 일본어로 옮긴 문장 ' + items.length + "개예요. 한국어 뜻을 보고 <b>내 말과 다른 것만</b> 누르세요. 다 본 뒤 맨 아래에서 복사해서 대화창에 붙여 주면 고칠게요.</p>";
  [["chk", "내 답에서 옮긴 문장 — 뜻이 내 말과 다르면 누르기"], ["pend", "답을 기다리는 초안"]].forEach(g => {
    const xs = items.filter(x => x.st === g[0]);
    if (!xs.length) return;
    h += '<h2 class="sec-h">' + g[1] + ' <span class="small">' + xs.length + "개</span></h2>" + xs.map(x => '<button class="fx" data-act="fx" data-id="' + x.id + '" aria-pressed="' + !!fx[x.id] + '"><span class="fxm">' + (fx[x.id] ? "✕ 내 말과 다름" : "맞으면 그대로 두기") +
      '</span><span class="fxk">' + esc(x.ko) + '</span><span class="fxj ja">' + x.html + '</span><span class="small">' + esc(x.where) + "</span></button>").join("");
  });
  const bad = items.filter(x => fx[x.id]).length;
  h += '<div style="margin-top:28px"><p class="small" id="fxn">다르다고 표시한 것 ' + bad + '개</p><button class="btn primary wide" data-act="fx-copy">표시한 것 복사하기</button><textarea id="fxout" hidden style="width:100%;min-height:140px;margin-top:10px;padding:8px;border:1px solid var(--line);background:var(--bg);font-size:14px"></textarea></div></main>';
  app.innerHTML = h;
}

/* ---------- 기록 ---------- */
function showLog() {
  const row = (a, b) => '<div class="rowl"><span class="tt">' + a + '</span><span class="ts">' + b + "</span></div>";
  let h = topHome(true) + '<main class="wrap"><h1>기록</h1>';
  h += '<h2 class="sec-h">통째 쓰기 <span class="small">' + S.log.essay.length + "편</span></h2>" + (S.log.essay.length ? '<div class="list">' + S.log.essay.slice().reverse().map(x => row(md(x.d) + " · " + esc(U[x.t] ? U[x.t].ko : x.t), clock((x.sec || 0) * 1000) + " · " + (x.ok ? "끝까지 씀" : "막혔음"))).join("") + "</div>" : '<p class="small">아직 없어요.</p>');
  h += '<h2 class="sec-h">면접 모의 <span class="small">' + S.log.mock.length + "번</span></h2>" + (S.log.mock.length ? '<div class="list">' + S.log.mock.slice().reverse().map(x => row(md(x.d), x.n ? "막히지 않은 것 " + x.ok + " / " + x.n : "")).join("") + "</div>" : '<p class="small">아직 없어요.</p>');
  h += '<h2 class="sec-h">처음 보는 주제 <span class="small">' + S.log.un.length + "번</span></h2>" + (S.log.un.length ? '<div class="list">' + S.log.un.slice().reverse().map(x => row(md(x.d) + " · " + esc(UNI[x.t] ? UNI[x.t].ko : x.t), x.ok ? "정할 수 있었음" : "막혔음")).join("") + "</div>" : '<p class="small">아직 없어요.</p>');
  h += '<h2 class="sec-h">예상 질문 <span class="small">' + qTried() + " / " + QM.length + '</span></h2><div class="list">' + (D.qcats || []).map(c => { const qs = QM.filter(q => q.cat === c[0]); return row(c[0] + ". " + esc(c[1]), "해 봄 " + qs.filter(q => qrec(q.id).n).length + " / " + qs.length + " · 막힘 " + qs.filter(q => qrec(q.id).n && !qrec(q.id).ok).length); }).join("") + "</div>";
  const stuck = qStuck();
  if (stuck.length) h += '<h2 class="sec-h">막힌 질문 <span class="small">' + stuck.length + '개</span></h2><div class="list">' + stuck.map(q => '<a class="rowl" href="#/q/' + q.id + '"><span class="tt">' + esc(q.ko) + '</span><span class="ts">' + (qrec(q.id).m || 1) + "번</span></a>").join("") + "</div>";
  app.innerHTML = h + "</main>";
}

/* ---------- 새 판 확인 ---------- */
let verT = 0;
function checkVersion() {
  if (location.protocol === "file:" || Date.now() - verT < 60000) return;
  verT = Date.now();
  fetch("version.json?" + Date.now(), {cache: "no-store"}).then(r => r.json()).then(v => {
    if (v && v.ver && v.ver !== D.ver && sessionStorage.getItem("sakubun-rl") !== v.ver && atHome()) {
      sessionStorage.setItem("sakubun-rl", v.ver);
      location.reload();
    }
  }).catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && atHome()) showHome(); });

/* ---------- 누르기 ---------- */
function startTask(task) {
  const s = buildSession(task);
  if (!s || s.steps.length < 2) { toast("지금은 할 수 있는 것이 없어요"); return; }
  S.sess = s; save();
  go("#/run");
}
const ACT = {
  next() { const live = liveSess(); if (live) { go("#/run"); return; } const t = nextTask(today()); if (t) startTask(t); else go("#/"); },
  resume() { go("#/run"); },
  warm() { startTask({t: "review"}); },
  "pv-go"() { if (!PV) return; try { localStorage.setItem("sakubun-now", D.start + "T10:00:00"); } catch (e) {} showHome(); },
  "pv-day"() { if (!PV) return; try { localStorage.setItem("sakubun-now", addDays(today(), 1) + "T10:00:00"); } catch (e) {} showHome(); },
  "pv-end"() { if (!PV) return; try { localStorage.removeItem("sakubun-now"); localStorage.removeItem(KEY); } catch (e) {} S = load(); furiClass(); showHome(); },
  more() { const P = planFor(today()); P.new = P.new.concat(remainingUnits().filter(id => P.new.indexOf(id) < 0).slice(0, 2)); save(); showHome(); },
  home() { stopAudio(); clearInterval(tick); const st = S.sess && cur(); if (st && st.t === "essay" && st.run) { st.el = essayElapsed(st); st.run = 0; save(); } go("#/"); },
  furi() { S.set.furi = !S.set.furi; save(); furiClass(); document.querySelectorAll('[data-act="furi"]').forEach(b => b.setAttribute("aria-pressed", !!S.set.furi)); },
  play(el) { play(el.dataset.au.split(",")); },
  free(el) { startTask({t: "unit", id: el.dataset.u, free: isDone(el.dataset.u)}); },
  fr(el) { startTask({t: el.dataset.k}); },
  voc(el) {
    const v = VOC[el.dataset.v], box = el.parentNode.querySelector(".vd");
    if (!v || !box) return;
    const on = el.getAttribute("aria-pressed") === "true";
    el.parentNode.querySelectorAll(".vc").forEach(b => b.setAttribute("aria-pressed", "false"));
    if (on) { box.textContent = ""; return; }
    el.setAttribute("aria-pressed", "true");
    box.innerHTML = '<span class="ja">' + esc(v.w) + " · " + esc(v.r) + "</span> — " + esc(v.m) + ' <span class="small">(' + esc(v.t) + ")</span>";
  },
  "ch-go"(el) { const c = CHI[el.dataset.k]; if (c) startTask({t: "qs", ids: c.q.map(q => q.id), title: c.ko}); },
  "qs-go"(el) { startTask(el.dataset.k === "ng" ? {t: "qs", n: 15, stuck: 1} : {t: "qs", n: QBATCH}); },
  "qa-show"() { const st = cur(); st.shown = 1; save(); showRun(); if (S.set.auto) play(ansClips(QI[st.q])); },
  "un-show"() { const st = cur(); st.shown = 1; save(); showRun(); window.scrollTo(0, 0); },
  "qv-q"() { QV.qshow = 1; showQOne(QV.id); },
  "qv-show"() { QV.shown = 1; showQOne(QV.id); if (S.set.auto) play(ansClips(QI[QV.id])); },
  "qv-ok"() { ACT.qvDone(true); },
  "qv-ng"() { ACT.qvDone(false); },
  qvDone(ok) {
    stopAudio();
    const id = QV.id, pool = QI[id].rel === "var" ? QS : QM, i = pool.indexOf(QI[id]);   // 바꿔 묻는 말은 건너뛰고 다음 질문으로
    markQ(id, ok); save();
    const nx = pool.slice(i + 1).filter(x => !qrec(x.id).n)[0] || pool[i + 1];
    QV = {};
    go(nx ? "#/q/" + nx.id : "#/q");
  },
  fx(el) {
    const fx = S.fx || (S.fx = {}), id = el.dataset.id;
    if (fx[id]) delete fx[id]; else fx[id] = 1;
    save();
    el.setAttribute("aria-pressed", !!fx[id]);
    el.querySelector(".fxm").textContent = fx[id] ? "✕ 내 말과 다름" : "맞으면 그대로 두기";
    const n = document.getElementById("fxn"); if (n) n.textContent = "다르다고 표시한 것 " + Object.keys(fx).length + "개";
  },
  "fx-copy"() {
    const fx = S.fx || {}, bad = factItems().filter(x => fx[x.id]);
    const txt = "뜻 확인 (판 " + (D.stamp || "") + ") — 다른 것 " + bad.length + "개" + (bad.length ? "\n" + bad.map(x => "· [" + x.id + "] " + x.ko).join("\n") : " (전부 맞음)");
    const ta = document.getElementById("fxout");
    ta.hidden = false; ta.value = txt; ta.focus(); ta.select();
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("복사했어요. 대화창에 붙여 주세요"), () => toast("아래 글을 복사해 주세요")); else toast("아래 글을 복사해 주세요"); } catch (e) { toast("아래 글을 복사해 주세요"); }
  },
  pass() { settle(true); },
  ok() { stopAudio(); settle(true); },
  ng() {
    stopAudio();
    const st = cur();
    if (st.t === "essay" || st.t === "unseen") {   // 통째 쓰기·처음 보는 주제는 바로 다시 시키지 않음: 기록만 하고 그 문장을 내일 복습에 넣음
      const d = today();
      st.bad = 1;
      (st.t === "essay" ? U[st.u].s : UNI[st.n].same ? U[UNI[st.n].same].s : [UNI[st.n].f, UNI[st.n].br, UNI[st.n].l]).forEach(id => { const r = S.s[id] || (S.s[id] = {m: 0}); r.m++; r.x = addDays(d, 1); S.sess.missed.push(id); });
      S.sess.n1++;
      st.retry = 1;
      settle(true);
      return;
    }
    settle(false);
  },
  "hw-next"() { const st = cur(); st.ph++; save(); showRun(); window.scrollTo(0, 0); },
  opt(el) { const st = cur(); if (st.pick != null) return; st.pick = +el.dataset.i; save(); showRun(); if (S.set.auto) play([SE[st.s].au]); },
  "chip-add"(el) { const st = cur(); st.built.push(+el.dataset.i); save(); showRun(); },
  "chip-del"(el) { const st = cur(); st.built = st.built.filter(i => i !== +el.dataset.i); save(); showRun(); },
  "o-clear"() { const st = cur(); st.built = []; save(); showRun(); },
  "o-check"() { const st = cur(), ch = SE[st.s].chunks; st.chk = 1; st.res = st.built.map(i => ch[i].p).join("") === ch.map(c => c.p).join("") ? 1 : 0; save(); showRun(); if (S.set.auto) play([SE[st.s].au]); },
  "r-hint"() { const st = cur(); st.hint = 1; save(); showRun(); },
  "r-show"() { const st = cur(); st.shown = 1; save(); showRun(); if (S.set.auto) play([SE[st.s].au]); },
  "q-show"() { const st = cur(); st.qshow = 1; save(); showRun(); },
  "s-show"() { const st = cur(); st.shown = 1; save(); showRun(); if (S.set.auto) play(U[st.u].say.map(s => SE[s].au)); },
  pk(el) { const st = cur(), b = el.dataset.b, i = st.sel.indexOf(b); if (i >= 0) st.sel.splice(i, 1); else if (st.sel.length < U[st.u].blocks.length) st.sel.push(b); save(); showRun(); },
  "p-check"() { const st = cur(), u = U[st.u]; st.chk = 1; st.res = u.blocks.length === st.sel.length && u.blocks.every(b => st.sel.indexOf(b) >= 0) ? 1 : 0; save(); showRun(); },
  "e-start"() { const st = cur(); st.run = 1; st.t0 = Date.now(); save(); showRun(); },
  "e-pause"() { const st = cur(); st.el = essayElapsed(st); st.run = 0; save(); showRun(); },
  "e-done"() { const st = cur(); st.el = essayElapsed(st); st.run = 0; st.shown = 1; save(); showRun(); window.scrollTo(0, 0); },
  "m-flag"(el) { const st = cur(), u = el.dataset.u; if (st.flag[u]) delete st.flag[u]; else st.flag[u] = 1; save(); const y = window.scrollY; showRun(); window.scrollTo(0, y); },
  "m-fin"() {
    const st = cur();
    st.qs.forEach(id => { markQ(id, !st.flag[id]); if (st.flag[id]) ansSids(QI[id]).forEach(s => S.sess.missed.push(s)); });
    S.sess.n1 = st.qs.length; S.sess.ok1 = st.qs.length - Object.keys(st.flag).length;
    settle(true);
  },
  strokes(el) {
    const ps = Array.prototype.slice.call(el.querySelectorAll("path"));
    clearInterval(el._t); ps.forEach(p => p.classList.add("off"));
    let i = 0; el._t = setInterval(() => { if (i >= ps.length) { clearInterval(el._t); return; } ps[i++].classList.remove("off"); }, 380);
  },
  "set-furi"(el) { S.set.furi = el.dataset.v === "1"; save(); furiClass(); showSet(); },
  "set-rate"(el) { S.set.rate = +el.dataset.v; save(); showSet(); },
  "set-auto"(el) { S.set.auto = el.dataset.v === "1"; save(); showSet(); },
  "set-qv"(el) { S.set.qv = el.dataset.v === "k" ? "k" : "n"; save(); showSet(); },
  dl(el) {
    if (D.pk) { toast("미리 보기 판에서는 들을 때 받아 와요"); return; }
    if (!window.caches) { toast("이 브라우저에서는 받아 둘 수 없어요"); return; }
    el.disabled = true;
    const hs = allClips(), msg = document.getElementById("dlmsg");
    let n = 0, fail = 0, i = 0;
    caches.open("sakubun-audio-1").then(c => {
      const one = () => {
        if (i >= hs.length) return Promise.resolve();
        const url = new URL(clipUrl(hs[i++]), location.href).href;
        return c.match(url).then(hit => hit || fetch(url).then(r => { if (!r.ok) throw 0; return c.put(url, r.clone()); }))
          .then(() => { n++; }, () => { fail++; }).then(() => { if (msg) msg.textContent = (n + fail) + " / " + hs.length + (fail ? " · 실패 " + fail : ""); return one(); });
      };
      return Promise.all([one(), one(), one(), one(), one(), one()]);
    }).then(() => { if (msg) msg.textContent = fail ? "받지 못한 것 " + fail + "개. 다시 눌러 주세요." : "다 받아 두었어요 (" + n + "개)."; el.disabled = false; });
  },
  exp() { const ta = document.getElementById("code"); ta.hidden = false; ta.value = "SK1:" + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); ta.focus(); ta.select(); toast("코드를 복사하세요"); },
  imp() {
    const ta = document.getElementById("code");
    if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ""; ta.placeholder = "여기에 코드를 붙여 넣고 다시 누르세요"; ta.focus(); return; }
    try { const o = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim().replace(/^SK1:/, ""))))); if (!o || o.v !== 1) throw 0; localStorage.setItem(KEY, JSON.stringify(o)); S = load(); furiClass(); toast("진도를 가져왔어요"); go("#/"); }
    catch (e) { toast("코드가 맞지 않아요"); }
  },
  reset(el) { if (el.dataset.sure) { localStorage.removeItem(KEY); S = load(); furiClass(); go("#/"); toast("처음으로 돌렸어요"); } else { el.dataset.sure = "1"; el.textContent = "정말 지우기"; } }
};
document.addEventListener("click", e => {
  const rb = e.target.closest && e.target.closest("ruby");
  if (rb && !S.set.furi) rb.classList.toggle("peek");
  const lk = e.target.closest && e.target.closest('a[href^="#/"]');
  if (lk) { e.preventDefault(); go(lk.getAttribute("href")); return; }
  const el = e.target.closest && e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === "next" && CUR === "#/run" && S.sess && cur().t !== "done") {
    const st = cur();
    settle(st.t === "cloze" ? st.pick === 0 : !!st.res);
    return;
  }
  if (a === "next" && S.sess && S.sess.fin) { S.sess = null; save(); }
  if (ACT[a]) ACT[a](el, e);
});

/* ---------- 길 찾기 (화면은 CUR 기준: 주소 바꾸기가 막혀도 화면은 맞게) ---------- */
let CUR = location.hash;
const atHome = () => CUR === "" || CUR === "#" || CUR === "#/";
function route() {
  stopAudio(); clearInterval(tick);
  const hsh = CUR.replace(/^#\/?/, ""), p = hsh.split("/");
  if (p[0] === "run") showRun();
  else if (p[0] === "list") showList();
  else if (p[0] === "u") showUnit(p[1]);
  else if (p[0] === "words") showWords();
  else if (p[0] === "w") showWord(p[1]);
  else if (p[0] === "free") showFree();
  else if (p[0] === "plan") showPlan();
  else if (p[0] === "exam") showExam();
  else if (p[0] === "set") showSet();
  else if (p[0] === "q") { if (p[1]) showQOne(p[1]); else showQ(); }
  else if (p[0] === "fact") showFact();
  else if (p[0] === "log") showLog();
  else showHome();
  window.scrollTo(0, 0);
}
function go(hsh) { CUR = hsh; if (location.hash !== hsh) { try { location.hash = hsh; } catch (e) {} } route(); }
window.addEventListener("hashchange", () => { if (location.hash === CUR) return; CUR = location.hash; route(); });
furiClass();
route();
window.__sakubun = {S: () => S, D: D, today: today, tasks: tasks, planFor: planFor, quotaK: quotaK, phase: phase, buildReview: buildReview, sumSec: sumSec, qTried: qTried, mockPool: mockPool, mockSeq: mockSeq, pickQs: pickQs, reload: () => { S = load(); route(); }};
})();
