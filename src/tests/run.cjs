/* 작문·면접 드릴 — 앱 자동 시험.
   node src/tests/run.cjs [site 폴더] [all|course|resume|layout|audio]
   - course : 지시서 5-4절 날짜표대로 11/30부터 날짜를 넘기며 매일 '오늘 할 것'을 끝까지 자동 풀이 + 하루·이틀 밀린 경우
   - resume : 풀다가 새로고침 → 같은 자리 / 진도 코드 내보내기 → 다른 브라우저에서 가져오기
   - layout : 아이패드 가로·세로·폰에서 모든 화면 종류의 가로 넘침·버튼 보임 검사 + 화면 사진
   - audio  : 음성 파일 누락 0, 실제 재생 */
const path = require("path"), fs = require("fs"), http = require("http");
const gl = require("child_process").execSync("npm root -g").toString().trim();
const pw = require(path.join(gl, "playwright"));
const SITE = path.resolve(process.argv[2] || path.join(__dirname, "..", "..", "site"));
const WHAT = process.argv[3] || "all";
const SHOTS = path.join(__dirname, "shots");
const MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".mp3": "audio/mpeg", ".svg": "image/svg+xml"};
let pass = 0, fail = 0;
const fails = [];
let lastOk = Date.now();
function ok(cond, name, extra) { lastOk = Date.now(); if (cond) pass++; else { fail++; fails.push(name + (extra ? " — " + extra : "")); console.log("  ✕ " + name + (extra ? " — " + extra : "")); } }
// 브라우저가 멈춰 서는 일이 있어서: 4분 동안 검사가 하나도 안 지나가면 스스로 끝냄
setInterval(() => { if (Date.now() - lastOk > 240000) { console.log("\n멈춤: 4분 동안 진행 없음 (통과 " + pass + " · 실패 " + fail + ")"); process.exit(3); } }, 5000).unref();

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(SITE, p);
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end("no"); return; }
      rsp.writeHead(200, {"Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store"});
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, "127.0.0.1", () => res({srv, url: "http://127.0.0.1:" + srv.address().port + "/"}));
  });
}

/* 페이지 안에서 도는 자동 풀이. wrong = 일부러 틀릴 확률. 한 화면씩 처리하고, 화면 종류·넘침을 기록. */
function solverSrc() {
  return function (opt) {
    const A = window.__sakubun, D = A.D, U = {};
    D.units.forEach(u => { U[u.id] = u; });
    let seed = opt.seed || 1;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const q = s => document.querySelector(s);
    const click = s => { const el = typeof s === "string" ? q(s) : s; if (!el) throw new Error("no element: " + s + " @ " + location.hash + " step=" + (q("main") && q("main").dataset.step)); if (el.disabled) throw new Error("disabled: " + s); el.click(); };
    const log = {steps: 0, kinds: {}, overflow: [], sessions: [], barHidden: []};
    const check = () => {
      const m = q("main"), k = m ? (m.dataset.step || location.hash) : "?";
      log.kinds[k] = (log.kinds[k] || 0) + 1;
      if (document.documentElement.scrollWidth > window.innerWidth + 1) log.overflow.push(k);
      const b = q(".bar .btn.primary");
      if (b && opt.checkBar) { const r = b.getBoundingClientRect(); if (r.width < 40 || r.left < 0 || r.right > window.innerWidth + 1) log.barHidden.push(k); }
    };
    const stepOnce = () => {
      const S = A.S(), st = S.sess.steps[S.sess.pos], wrong = rnd() < (opt.wrong || 0);
      check();
      log.steps++;
      switch (st.t) {
        case "view": click('[data-act="pass"]'); break;
        case "hw": while (q('[data-act="hw-next"]')) click('[data-act="hw-next"]'); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        case "cloze": click('.opt[data-i="' + (wrong ? 1 : 0) + '"]'); check(); click('.bar [data-act="next"]'); break;
        case "order": {
          const n = D.sents[st.s].chunks.length, idx = Array.from({length: n}, (_, i) => i);
          if (wrong) idx.reverse();
          idx.forEach(i => click('.pool .chip[data-i="' + i + '"]'));
          click('[data-act="o-check"]'); check(); click('.bar [data-act="next"]'); break;
        }
        case "recall": if (rnd() < 0.3 && q('[data-act="r-hint"]')) click('[data-act="r-hint"]'); click('[data-act="r-show"]'); check(); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        case "speak": if (rnd() < 0.3) click('[data-act="q-show"]'); click('[data-act="s-show"]'); check(); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        case "pick": {
          const u = U[st.u];
          const want = wrong ? D.units.filter(x => x.kind === "b" && u.blocks.indexOf(x.id) < 0).slice(0, u.blocks.length).map(x => x.id) : u.blocks;
          want.forEach(b => click('.pk[data-b="' + b + '"]'));
          click('[data-act="p-check"]'); check(); click('.bar [data-act="next"]'); break;
        }
        case "essay": if (st.timed) { click('[data-act="e-start"]'); check(); } click('[data-act="e-done"]'); check(); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        case "mockq": click('[data-act="pass"]'); break;
        case "mockend": if (wrong) click('[data-act="m-flag"]'); click('[data-act="m-fin"]'); break;
        case "qa": if (rnd() < 0.3 && q('[data-act="q-show"]')) click('[data-act="q-show"]'); click('[data-act="qa-show"]'); check(); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        case "unseen": click('[data-act="un-show"]'); check(); click(wrong ? '[data-act="ng"]' : '[data-act="ok"]'); break;
        default: throw new Error("unknown step " + st.t);
      }
    };
    const runSession = () => {
      let guard = 0;
      while (true) {
        const S = A.S();
        if (!S.sess) throw new Error("no session");
        const st = S.sess.steps[S.sess.pos];
        if (st.t === "done") { check(); log.sessions.push({title: S.sess.title, n1: S.sess.n1, ok1: S.sess.ok1, len: S.sess.steps.length - 1}); return; }
        stepOnce();
        if (++guard > 3000) throw new Error("끝나지 않는 세션: " + S.sess.title);
      }
    };
    // 홈에서 시작: 오늘 할 것을 전부
    let guard = 0;
    if (location.hash !== "" && location.hash !== "#/") { location.hash = "#/"; A.reload(); }
    A.reload();
    check();
    const before = A.tasks(A.today()).map(t => ({t: t.t, id: t.id, title: t.title, sub: t.sub, sec: t.sec, done: t.done, off: !!t.off}));
    while (true) {
      const b = q('[data-act="start"]') || q('[data-act="resume"]') || q('main [data-act="next"]');
      if (!b) break;
      b.click();
      if (!A.S().sess) break;
      runSession();
      // 결과 화면에서 '다음'이 있으면 그걸로, 없으면 홈
      const nx = q('.bar [data-act="next"]');
      if (nx && opt.viaNext) { nx.click(); if (A.S().sess && !A.S().sess.fin) { runSession(); } }
      click('.bar [data-act="home"]');
      A.reload();
      if (++guard > 140) throw new Error("오늘 할 것이 끝나지 않음 " + A.today() + " " + JSON.stringify(A.tasks(A.today()).filter(t => !t.done).map(t => [t.t, t.title, t.sub, !!t.off])) + " 마지막 세션 " + JSON.stringify(log.sessions.slice(-3)));
      if (opt.maxSessions && guard >= opt.maxSessions) break;
    }
    const S = A.S();
    log.before = before;
    log.after = A.tasks(A.today()).map(t => ({t: t.t, title: t.title, done: t.done, off: !!t.off}));
    log.doneUnits = D.units.filter(u => S.u[u.id] && S.u[u.id].st === "done").length;
    log.words = Object.keys(S.w).length;
    log.qTried = A.qTried();
    log.qTotal = (D.qs || []).filter(q => q.rel !== "var").length;
    log.h1 = (q("h1") || {}).textContent;
    return log;
  };
}

async function newPage(browser, vp, url, nowIso, state) {
  const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 1, hasTouch: true});
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/i.test(m.text())) errs.push("console: " + m.text()); });
  await page.addInitScript(([n, st]) => { if (n) localStorage.setItem("sakubun-now", n); if (st && !localStorage.getItem("sakubun-v5")) localStorage.setItem("sakubun-v5", st); }, [nowIso, state || null]);
  await page.goto(url, {waitUntil: "load"});
  return {ctx, page, errs};
}
const setNow = (page, iso) => page.evaluate(n => { localStorage.setItem("sakubun-now", n); window.__sakubun.reload(); }, iso);
function addDays(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

const START = "2026-11-30";
async function runDays(page, days, wrong, seed0) {
  const rows = [];
  for (const d of days) {
    await setNow(page, d + "T10:00:00");
    const log = await page.evaluate(solverSrc(), {wrong, seed: (seed0 || 7) + rows.length, viaNext: rows.length % 2 === 0});
    const units = log.before.filter(t => t.t === "unit");
    const k = units.reduce((a, t) => { a[t.id[0]] = (a[t.id[0]] || 0) + 1; return a; }, {});
    const wt = log.before.find(t => t.t === "words");
    const sec = log.before.filter(t => !t.done && !t.off).reduce((a, t) => a + t.sec, 0);
    const cnt = log.before.reduce((a, t) => { a[t.t] = (a[t.t] || 0) + 1; return a; }, {});
    rows.push({d, b: k.b || 0, t: k.t || 0, i: k.i || 0, e: k.e || 0, w: wt ? +(wt.title.match(/\d+/) || [0])[0] : 0, rev: (log.before.find(t => t.t === "review") || {}).sub || "-",
      essay: cnt.essay || 0, mock: cnt.mock || 0, un: cnt.un || 0, qs: log.before.filter(t => t.t === "qs").reduce((a, t) => a + (+(t.title.match(/\d+/) || [0])[0]), 0), qTried: log.qTried, qTotal: log.qTotal,
      min: Math.round(sec / 60), done: log.doneUnits, words: log.words, steps: log.steps, after: log.after, overflow: log.overflow, h1: log.h1});
  }
  return rows;
}
const dayList = (a, b, skip) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) if (!skip || skip.indexOf(d) < 0) out.push(d); return out; };
function firstDay(rows, pred) { const r = rows.find(pred); return r ? r.d : null; }

async function testCourse(browser, url, wrong, show) {
  // 표대로(하루도 안 빠뜨림)
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url, "2026-11-23T10:00:00");
  const info = await page.evaluate(() => { const D = window.__sakubun.D; return {exam: D.exam, days: D.days, total: D.units.length, nb: D.units.filter(u => u.kind === "b").length, nw: D.words.length}; });
  // 시작 전(이번 주): 할 것이 없어야 함
  for (const d of ["2026-11-23", "2026-11-29"]) {
    await setNow(page, d + "T10:00:00");
    const pre = await page.evaluate(() => ({n: window.__sakubun.tasks(window.__sakubun.today()).length, h1: document.querySelector("h1").textContent, btn: !!document.querySelector('main [data-act="next"], main [data-act="start"]')}));
    ok(pre.n === 0 && !pre.btn && /시작해요/.test(pre.h1), "시작 전 " + d + " · 할 것 없음, 시작 날짜 안내", JSON.stringify(pre));
  }
  const rows = await runDays(page, dayList(START, info.exam), wrong);
  const tag = "표대로(틀릴 확률 " + wrong + ")";
  rows.forEach(r => {
    const row = info.days[r.d] || {};
    ok(r.after.every(t => t.done || t.off), tag + " · " + r.d + " 오늘 할 것이 전부 끝남", JSON.stringify(r.after.filter(t => !t.done)));
    ok(r.overflow.length === 0, tag + " · " + r.d + " 가로 넘침 없음", r.overflow.join(","));
    ok(["b", "t", "i", "e", "w"].every(k => r[k] === (row[k] || 0)), tag + " · " + r.d + " 새로 하는 양이 날짜표와 같음", JSON.stringify([r.b, r.t, r.i, r.e, r.w]) + " vs " + JSON.stringify(row));
    ok(r.essay === (row.essay || 0) && r.mock === (row.mock || 0) && r.un === (row.un || 0), tag + " · " + r.d + " 통째 쓰기·면접 모의·처음 보는 주제 횟수가 날짜표와 같음", r.essay + "/" + r.mock + "/" + r.un);
    {
      // 예상 질문: 표의 누적 수까지(면접 모의에서 해 본 것도 셈). 그날 시작할 때 해 본 수를 앞 줄에서 가져옴
      const i = rows.indexOf(r), prev = i > 0 ? rows[i - 1].qTried : 0;
      const cum = Object.keys(info.days).filter(x => x <= r.d).reduce((a, x) => a + (info.days[x].q || 0), 0);
      const want = row.q ? Math.max(0, Math.min(60, cum - prev, r.qTotal - prev)) : 0;
      ok(r.qs === want, tag + " · " + r.d + " 예상 질문 수가 날짜표의 누적 수와 맞음", r.qs + " / 기대 " + want + " (표 " + (row.q || 0) + ")");
    }
    if (row.min) ok(r.min <= row.min * 1.1 + 2, tag + " · " + r.d + " 예상 시간이 표의 시간 안(+10%)", "약 " + r.min + "분 / 표 " + row.min + "분");
  });
  const blocksBy = firstDay(rows, r => r.d >= "2026-12-04"), get = d => rows.find(r => r.d === d) || {};
  ok(await page.evaluate(() => 1) && get("2026-12-04").done >= 16, tag + " · 12/4까지 블록 8개 + 면접 답 8개", "누적 " + get("2026-12-04").done);
  ok(get("2026-12-09").done === info.total, tag + " · 12/9까지 전 단위 1회", "누적 " + get("2026-12-09").done + "/" + info.total);
  ok(get("2026-12-09").words === info.nw, tag + " · 12/9까지 쓸 글자 전부", get("2026-12-09").words + "/" + info.nw);
  ok(get("2026-12-10").b + get("2026-12-10").t + get("2026-12-10").i + get("2026-12-10").e + get("2026-12-10").w === 0, tag + " · 12/10은 새로 외우는 것이 없음");
  ok(get("2026-12-10").qTried === get("2026-12-10").qTotal && get("2026-12-10").qTotal > 0, tag + " · 12/10까지 예상 질문을 전부 한 번씩", get("2026-12-10").qTried + "/" + get("2026-12-10").qTotal);
  const rest = get("2026-12-11");
  ok(rest.b + rest.t + rest.i + rest.e + rest.w + rest.essay + rest.mock === 0 && rest.rev === "-" && rest.steps === 0 && /할 것이 없어요/.test(rest.h1 || ""), tag + " · 12/11(출국)은 할 것이 없음", JSON.stringify([rest.rev, rest.steps, rest.h1]));
  ok(/시험 날/.test(get(info.exam).h1 || ""), tag + " · 12/12 홈이 시험 날 화면", get(info.exam).h1);
  ok(errs.length === 0, tag + " · 스크립트 오류 0", errs.slice(0, 3).join(" | "));
  if (show) { console.log("  " + tag); rows.forEach(r => console.log("   " + r.d.slice(5) + "  블록 " + r.b + " · 주제 " + r.t + " · 면접 " + r.i + " · 인사 " + r.e + " · 글자 " + r.w + " · 복습 " + r.rev + " · 질문 " + r.qs + "(누적 " + r.qTried + ") · 통째 " + r.essay + " · 처음 " + r.un + " · 모의 " + r.mock + " · 약 " + r.min + "분(표 " + ((info.days[r.d] || {}).min || "-") + "분) · 누적 " + r.done + "/" + info.total)); }
  await ctx.close();
  return rows;
}

async function testSlip(browser, url, name, skip, expect, show) {
  // 밀린 경우: skip 날짜를 통째로 빠뜨림 → 남은 날에 나눠 넣어 기한을 지키는지
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url, START + "T10:00:00");
  const info = await page.evaluate(() => { const D = window.__sakubun.D; return {exam: D.exam, total: D.units.length, nb: D.units.filter(u => u.kind === "b").length, nw: D.words.length}; });
  const rows = await runDays(page, dayList(START, info.exam, skip), 0.15, 3);
  const st = await page.evaluate(() => { const A = window.__sakubun, S = A.S(), D = A.D; const day = k => D.units.filter(u => u.kind === k).map(u => (S.u[u.id] || {}).done || "9999").sort().pop(); return {b: day("b"), all: ["b", "t", "i", "e"].map(day).sort().pop(), w: D.words.map(w => (S.w[w.id] || {}).i || "9999").sort().pop()}; });
  ok(rows.every(r => r.after.every(t => t.done || t.off)), name + " · 한 날은 그날 할 것이 전부 끝남");
  ok(st.b <= expect.blocks, name + " · 블록 8개가 " + expect.blocks.slice(5) + "까지", "끝난 날 " + st.b);
  ok(st.all <= expect.all, name + " · 전 단위 1회가 " + expect.all.slice(5) + "까지", "끝난 날 " + st.all);
  ok(st.w <= expect.all, name + " · 쓸 글자 전부 " + expect.all.slice(5) + "까지", "끝난 날 " + st.w);
  ok(errs.length === 0, name + " · 스크립트 오류 0", errs.slice(0, 3).join(" | "));
  if (show) { console.log("  " + name + " (빠뜨린 날 " + skip.map(x => x.slice(5)).join(", ") + ")"); rows.forEach(r => console.log("   " + r.d.slice(5) + "  블록 " + r.b + " · 주제 " + r.t + " · 면접 " + r.i + " · 인사 " + r.e + " · 글자 " + r.w + " · 통째 " + r.essay + " · 모의 " + r.mock + " · 약 " + r.min + "분 · 누적 " + r.done + "/" + info.total)); }
  await ctx.close();
}

async function testResume(browser, url) {
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url, START + "T10:00:00");
  // 첫 판(쓸 글자) 도중에 새로고침 → 같은 자리
  await page.click('main [data-act="next"]');
  await page.click('[data-act="hw-next"]');
  const w0 = await page.evaluate(() => { const S = window.__sakubun.S(); return JSON.stringify([S.sess.pos, S.sess.steps[S.sess.pos]]); });
  await page.reload({waitUntil: "load"});
  const w1 = await page.evaluate(() => { const S = window.__sakubun.S(); return JSON.stringify([S.sess.pos, S.sess.steps[S.sess.pos]]); });
  ok(w0 === w1, "쓸 글자 도중 새로고침 뒤 같은 자리·같은 단계", w0 + " vs " + w1);
  await page.goto(url, {waitUntil: "load"});
  await page.evaluate(solverSrc(), {wrong: 0, seed: 1, maxSessions: 1});
  await page.click('main [data-act="next"]');
  // 몇 단계 진행
  for (let i = 0; i < 6; i++) {
    const t = await page.evaluate(() => { const S = window.__sakubun.S(); return S.sess.steps[S.sess.pos].t; });
    if (t === "view") await page.click('[data-act="pass"]');
    else if (t === "hw") { while (await page.$('[data-act="hw-next"]')) await page.click('[data-act="hw-next"]'); await page.click('[data-act="ok"]'); }
    else if (t === "cloze") { await page.click('.opt[data-i="0"]'); await page.click('.bar [data-act="next"]'); }
    else break;
  }
  // 빈칸 문제에서 답만 고르고(다음 누르기 전) 새로고침
  let t = await page.evaluate(() => { const S = window.__sakubun.S(); return S.sess.steps[S.sess.pos].t; });
  if (t === "cloze") await page.click('.opt[data-i="1"]');
  const before = await page.evaluate(() => { const S = window.__sakubun.S(); return {pos: S.sess.pos, st: JSON.stringify(S.sess.steps[S.sess.pos]), html: document.querySelector("main").innerHTML.length}; });
  await page.reload({waitUntil: "load"});
  const after = await page.evaluate(() => { const S = window.__sakubun.S(); return {hash: location.hash, pos: S.sess.pos, st: JSON.stringify(S.sess.steps[S.sess.pos]), html: document.querySelector("main").innerHTML.length, picked: !!document.querySelector(".opt.bad")}; });
  ok(after.hash === "#/run" && after.pos === before.pos && after.st === before.st, "새로고침 뒤 같은 문제·같은 상태", JSON.stringify([before.pos, after.pos]));
  if (t === "cloze") ok(after.picked, "새로고침 뒤 고른 답이 그대로 보임");
  // 탭을 닫았다 다시 열기(홈으로) → '이어서 하기'
  await page.goto(url, {waitUntil: "load"});
  const resume = await page.$('[data-act="resume"]');
  ok(!!resume, "홈에 '이어서 하기'가 보임");
  await resume.click();
  const pos2 = await page.evaluate(() => window.__sakubun.S().sess.pos);
  ok(pos2 === before.pos, "이어서 하기 → 같은 자리", pos2 + " vs " + before.pos);
  // 진도 코드 내보내기 → 새 브라우저에 가져오기
  await page.goto(url + "#/set", {waitUntil: "load"}); await page.waitForTimeout(150);
  await page.click('[data-act="exp"]');
  const code = await page.$eval("#code", el => el.value);
  const stateA = await page.evaluate(() => localStorage.getItem("sakubun-v5"));
  const b = await newPage(browser, {width: 820, height: 1180}, url + "#/set", START + "T10:00:00");
  await b.page.click('[data-act="imp"]');
  await b.page.fill("#code", code);
  await b.page.click('[data-act="imp"]');
  await b.page.waitForFunction(() => location.hash === "#/" || location.hash === "");
  const stateB = await b.page.evaluate(() => localStorage.getItem("sakubun-v5"));
  ok(stateA === stateB, "진도 코드로 옮긴 기록이 같음");
  ok(!!(await b.page.$('[data-act="resume"]')), "옮긴 브라우저에서도 '이어서 하기'");
  // 후리가나 끄기 → 유지
  await b.page.click('[data-act="furi"]');
  await b.page.reload({waitUntil: "load"});
  ok(await b.page.evaluate(() => document.body.classList.contains("nofuri")), "후리가나 끄기가 새로고침 뒤에도 유지");
  // 초기화
  await b.page.goto(url + "#/set", {waitUntil: "load"}); await b.page.waitForTimeout(150);
  await b.page.click('[data-act="reset"]'); await b.page.click('[data-act="reset"]');
  ok(await b.page.evaluate(() => { const S = window.__sakubun.S(); return !S.sess && !Object.keys(S.u).length && !Object.keys(S.w).length; }), "초기화하면 처음 상태");
  ok(errs.length === 0 && b.errs.length === 0, "이어서 하기·옮기기 · 스크립트 오류 0", errs.concat(b.errs).slice(0, 3).join(" | "));
  await b.ctx.close(); await ctx.close();
}

async function testQ(browser, url, lateState) {
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url + "#/q", "2026-12-08T10:00:00", lateState);
  const info = await page.evaluate(() => { const A = window.__sakubun, D = A.D;
    const heads = [...document.querySelectorAll(".chain")].map(c => { const a = c.querySelector(".qc"); return a ? a.getAttribute("href").slice(4) : ""; });
    return {n: D.qs.filter(q => q.rel !== "var").length, all: D.qs.length, cells: document.querySelectorAll(".qc").length, chains: document.querySelectorAll(".chain").length, nch: D.qch.length, tried: A.qTried(),
      heads: heads, mains: D.qch.map(c => c.main), cats: D.qch.map(c => c.cat).join(""), secs: document.querySelectorAll("main > .sec-h").length, low: D.qs.filter(q => q.low).length,
      orphan: D.qs.filter(q => q.par && !D.qs.some(p => p.id === q.par)).length}; });
  ok(info.cells === info.n && info.n >= 60 && info.n <= 120, "예상 질문 전체 · 질문 칸 수 = 세는 질문 수(바꿔 묻는 말은 빼고)", info.cells + "/" + info.n + " (전체 " + info.all + ")");
  ok(info.chains === info.nch && info.nch >= 15, "예상 질문 전체 · 묶음마다 한 덩이", info.chains + "/" + info.nch);
  ok(JSON.stringify(info.heads) === JSON.stringify(info.mains), "예상 질문 전체 · 묶음의 첫 칸은 큰 질문");
  ok(/^A+B+C+D+$/.test(info.cats) && info.secs === 4, "예상 질문 전체 · 나올 확률이 높은 등급부터(A → B → C → D)", info.cats + " / " + info.secs);
  ok(info.low === 0 && info.orphan === 0, "예상 질문 · 뺀 질문이 남아 있지 않고, 꼬리 질문은 모두 앞 질문이 있음", info.low + "/" + info.orphan);
  // 묶음 하나를 이어서 연습: 큰 질문 → 꼬리 질문 순서 그대로
  await page.click('.chain:nth-of-type(2) [data-act="ch-go"]');
  const chs = await page.evaluate(() => { const A = window.__sakubun, S = A.S(), c = A.D.qch[1]; const want = c.ids.filter(id => A.D.qs.find(q => q.id === id).rel !== "var");
    return {kind: S.sess && S.sess.kind, got: S.sess ? S.sess.steps.filter(s => s.t === "qa").map(s => s.q) : [], want: want}; });
  ok(chs.kind === "qs" && JSON.stringify(chs.got) === JSON.stringify(chs.want) && chs.want.length >= 3, "묶음 이어서 연습 · 큰 질문 → 이어지는 꼬리 질문 순서로 나옴", JSON.stringify(chs.got));
  await page.evaluate(() => { const S = window.__sakubun.S(); S.sess = null; localStorage.setItem("sakubun-v5", JSON.stringify(S)); window.__sakubun.reload(); });
  // 면접 모의: 큰 질문 뒤에 그 묶음의 꼬리 질문이 이어짐
  const mk = await page.evaluate(() => { const A = window.__sakubun, Q = {}; A.D.qs.forEach(q => Q[q.id] = q); const out = [];
    for (let i = 0; i < 30; i++) { const seq = A.mockSeq(); if (!seq) { out.push({n: 0}); continue; }
      let fu = 0, bad = 0, cur = null;
      seq.forEach((id, k) => { const q = Q[id]; if (q.rel === "fu") { fu++; if (k === seq.length - 1 && /質問はありますか/.test(q.plain)) fu--; else if (q.ch !== cur) bad++; } else cur = q.ch; });
      out.push({n: seq.length, fu: fu, bad: bad, last: /質問はありますか/.test(Q[seq[seq.length - 1]].plain), dup: new Set(seq).size !== seq.length}); }
    return out; });
  ok(mk.every(m => m.n >= 6 && m.n <= 9 && m.fu >= 2 && m.bad === 0 && m.last && !m.dup), "면접 모의 · 큰 질문 3개 + 이어지는 질문, 마지막은 '질문 있습니까' (30번 뽑아 봄)", JSON.stringify(mk.filter(m => !(m.n >= 6 && m.n <= 9 && m.fu >= 2 && m.bad === 0 && m.last && !m.dup)).slice(0, 3)));
  await page.goto(url + "#/q", {waitUntil: "load"}); await page.waitForTimeout(150); await page.waitForSelector(".chain .qc");   // 주소 끝(#)만 바뀌는 이동은 화면이 바뀔 때까지 기다림
  // 질문 하나: 듣기 → 답 보기 → 답했음 → 다음 안 해 본 질문으로
  const first = await page.evaluate(() => { const A = window.__sakubun, S = A.S(); return A.D.qs.filter(q => q.rel !== "var" && !(S.q[q.id] && S.q[q.id].n))[0].id; });
  await page.click('.qc[href="#/q/' + first + '"]');
  ok(await page.evaluate(() => !!document.querySelector('[data-act="qv-show"]') && !document.querySelector(".sent")), "질문 하나 · 처음에는 답이 가려져 있음");
  await page.click('[data-act="qv-show"]');
  ok(await page.evaluate(() => document.querySelectorAll(".sent").length > 0 && !!document.querySelector('[data-act="qv-ok"]')), "질문 하나 · 답 보기 → 연결된 답 문장이 나옴");
  await page.click('[data-act="qv-ok"]');
  const after = await page.evaluate(id => { const A = window.__sakubun, S = A.S(); return {rec: S.q[id], hash: location.hash, tried: A.qTried()}; }, first);
  ok(after.rec && after.rec.n === 1 && after.rec.ok === 1 && after.tried === info.tried + 1, "질문 하나 · 답했음 → 기록되고 해 본 수가 늘어남", JSON.stringify(after));
  ok(/^#\/q\/[A-D]\d\d$/.test(after.hash) && after.hash !== "#/q/" + first, "질문 하나 · 다음 안 해 본 질문으로 넘어감", after.hash);
  await page.click('[data-act="qv-show"]'); await page.click('[data-act="qv-ng"]');
  const ng = await page.evaluate(() => { const S = window.__sakubun.S(); return Object.keys(S.q).filter(k => S.q[k].ok === 0).length; });
  ok(ng >= 1, "질문 하나 · 막혔음 → 막힌 질문으로 기록", String(ng));
  await page.goto(url + "#/q", {waitUntil: "load"}); await page.waitForTimeout(150); await page.waitForSelector(".chain .qc");   // 주소 끝(#)만 바뀌는 이동은 화면이 바뀔 때까지 기다림
  ok(await page.evaluate(() => document.querySelectorAll(".qc.ok").length >= 1 && document.querySelectorAll(".qc.ng").length >= 1), "예상 질문 전체 · 칸에 답했음·막혔음이 표시됨");
  // 안 해 본 질문 10개 → 한 판
  await page.click('[data-act="qs-go"][data-k="new"]');
  const sess = await page.evaluate(() => { const S = window.__sakubun.S(); return S.sess ? {kind: S.sess.kind, n: S.sess.steps.length - 1, t: S.sess.steps[0].t} : null; });
  ok(sess && sess.kind === "qs" && sess.n === 10 && sess.t === "qa", "안 해 본 질문 10개 → 예상 질문 한 판", JSON.stringify(sess));
  await page.evaluate(() => { const S = window.__sakubun.S(); S.sess = null; localStorage.setItem("sakubun-v5", JSON.stringify(S)); window.__sakubun.reload(); });
  // 질문 목소리 설정
  const getVoice = () => page.evaluate(() => { const A = window.__sakubun, q = A.D.qs[0]; return {btn: document.querySelector('.qbox [data-act="play"]').dataset.au, k: q.auk, n: q.au}; });
  await page.goto(url + "#/q/A01", {waitUntil: "load"}); await page.waitForTimeout(150); await page.waitForSelector('.qbox [data-act="play"]');
  const v0 = await getVoice();
  ok(v0.btn === v0.k && v0.k !== v0.n, "질문 목소리 기본은 게이타", JSON.stringify(v0));
  await page.goto(url + "#/set", {waitUntil: "load"}); await page.waitForTimeout(150);
  await page.click('[data-act="set-qv"][data-v="n"]');
  await page.goto(url + "#/q/A01", {waitUntil: "load"}); await page.waitForTimeout(150); await page.waitForSelector('.qbox [data-act="play"]');
  const voice = await getVoice();
  ok(voice.btn === voice.n, "질문 목소리를 나나미로 바꾸면 질문 음성이 바뀜", JSON.stringify(voice));
  // 사실 확인
  await page.goto(url + "#/fact", {waitUntil: "load"}); await page.waitForTimeout(150);
  const fx = await page.evaluate(() => document.querySelectorAll(".fx").length);
  ok(fx > 0, "사실 확인 · 확인이 필요한 문장이 나옴", String(fx));
  await page.click(".fx"); await page.click('[data-act="fx-copy"]');
  const out = await page.$eval("#fxout", el => el.value);
  ok(/다른 것 1개/.test(out) && /\[.+\]/.test(out), "사실 확인 · 표시한 것만 글로 뽑힘", out.slice(0, 80));
  await page.goto(url + "#/log", {waitUntil: "load"}); await page.waitForTimeout(150);
  ok(await page.evaluate(() => /기록/.test(document.querySelector("h1").textContent) && document.querySelectorAll(".rowl").length >= 8), "기록 화면이 열림");
  // 단어장 낱말 칩
  await page.goto(url + "#/u/b1", {waitUntil: "load"}); await page.waitForTimeout(150);
  const chip = await page.$(".vc");
  ok(!!chip, "문장 아래에 단어장 낱말이 나옴");
  if (chip) { await chip.click(); ok(await page.evaluate(() => (document.querySelector(".vd").textContent || "").length > 3), "단어장 낱말을 누르면 읽기와 뜻이 나옴"); }
  ok(errs.length === 0, "예상 질문·사실 확인·기록 · 스크립트 오류 0", errs.slice(0, 3).join(" | "));
  await ctx.close();
}

async function testLayout(browser, name, url, lateState) {
  fs.mkdirSync(SHOTS, {recursive: true});
  const sizes = [["ipad-land", 1180, 820], ["ipad-port", 820, 1180], ["ipad-old-land", 1024, 768], ["ipad-old-port", 768, 1024], ["phone", 390, 844]];
  for (const [label, w, h] of sizes) {
    // (1) 1일차 전체를 자동 풀이하며 화면마다 넘침 검사
    const p0 = await newPage(browser, {width: w, height: h}, url, "2026-11-24T10:00:00");
    ok(await p0.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), name + " " + label + " · 시작 전 홈 가로 넘침 없음");
    await p0.ctx.close();
    const a = await newPage(browser, {width: w, height: h}, url, START + "T10:00:00");
    const log = await a.page.evaluate(solverSrc(), {wrong: 0.2, seed: 5, checkBar: true});
    ok(log.overflow.length === 0, name + " " + label + " · 1일차 화면 가로 넘침 없음", [...new Set(log.overflow)].join(","));
    ok(log.barHidden.length === 0, name + " " + label + " · 아래 버튼이 화면 안에 있음", [...new Set(log.barHidden)].join(","));
    for (const r of ["#/list", "#/words", "#/plan", "#/free", "#/exam", "#/set", "#/u/b1", "#/u/t1", "#/u/t16", "#/u/i1", "#/w/w001", "#/q", "#/q/A01", "#/fact", "#/log"]) {
      await a.page.goto(url + r, {waitUntil: "load"});
      const over = await a.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      ok(!over, name + " " + label + " · " + r + " 가로 넘침 없음");
    }
    ok(a.errs.length === 0, name + " " + label + " · 스크립트 오류 0", a.errs.slice(0, 3).join(" | "));
    await a.ctx.close();
    // (2) 뒤쪽 날짜(통째 쓰기·모의·조립이 있는 날)도 같은 검사
    if (lateState) {
      const b = await newPage(browser, {width: w, height: h}, url, "2026-12-08T10:00:00", lateState);
      const lg = await b.page.evaluate(solverSrc(), {wrong: 0.2, seed: 9, checkBar: true});
      ok(lg.overflow.length === 0, name + " " + label + " · 12/8 화면 가로 넘침 없음", [...new Set(lg.overflow)].join(","));
      ok(lg.barHidden.length === 0, name + " " + label + " · 12/8 아래 버튼이 화면 안에 있음", [...new Set(lg.barHidden)].join(","));
      ok(["essay", "mockq", "mockend", "pick", "qa", "unseen"].every(k => lg.kinds[k] > 0), name + " " + label + " · 12/8에 통째 쓰기·모의·블록 고르기·예상 질문·처음 보는 주제 화면이 나옴", JSON.stringify(lg.kinds));
      ok(b.errs.length === 0, name + " " + label + " · 12/8 스크립트 오류 0", b.errs.slice(0, 3).join(" | "));
      await b.ctx.close();
    }
  }
}

async function shots(browser, name, url, lateState) {
  fs.mkdirSync(SHOTS, {recursive: true});
  for (const [label, w, h] of [["land", 1180, 820], ["port", 820, 1180]]) {
    const a = await newPage(browser, {width: w, height: h}, url, "2026-11-24T10:00:00");
    const snap = async n => { await a.page.waitForTimeout(350); await a.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-" + n + ".png"), fullPage: false}); };
    await snap("00-before");
    await setNow(a.page, START + "T10:00:00");
    await snap("01-first");
    await a.page.click('main [data-act="next"]');
    const seen = {};
    let sessions = 0;
    for (let i = 0; i < 400; i++) {
      const st = await a.page.evaluate(() => { const S = window.__sakubun.S(); const s = S.sess && S.sess.steps[S.sess.pos]; return s ? {t: s.t, ph: s.ph, shown: s.shown} : null; });
      if (!st) break;
      if (st.t === "done") { if (!seen.done) { seen.done = 1; await snap("done"); } if (++sessions >= 2) break; await a.page.click('.bar [data-act="next"]'); continue; }
      const key = st.t + (st.t === "hw" ? st.ph : "");
      if (!seen[key]) { seen[key] = 1; await snap(key); }
      if (st.t === "view") await a.page.click('[data-act="pass"]');
      else if (st.t === "hw") { if (await a.page.$('[data-act="hw-next"]')) await a.page.click('[data-act="hw-next"]'); else await a.page.click('[data-act="ok"]'); }
      else if (st.t === "cloze") { await a.page.click('.opt[data-i="' + (seen.clozeFb ? 0 : 1) + '"]'); if (!seen.clozeFb) { seen.clozeFb = 1; await snap("cloze-fb"); } await a.page.click('.bar [data-act="next"]'); }
      else if (st.t === "order") {
        const n = await a.page.evaluate(() => { const S = window.__sakubun.S(); return window.__sakubun.D.sents[S.sess.steps[S.sess.pos].s].chunks.length; });
        for (let k = 0; k < n; k++) { await a.page.click('.pool .chip[data-i="' + k + '"]'); if (k === 1 && !seen.orderMid) { seen.orderMid = 1; await snap("order-mid"); } }
        await a.page.click('[data-act="o-check"]'); if (!seen.orderFb) { seen.orderFb = 1; await snap("order-fb"); } await a.page.click('.bar [data-act="next"]');
      } else if (st.t === "recall") { await a.page.click('[data-act="r-show"]'); if (!seen.recallShown) { seen.recallShown = 1; await snap("recall-shown"); } await a.page.click('[data-act="ok"]'); }
      else if (st.t === "speak") { await a.page.click('[data-act="s-show"]'); if (!seen.speakShown) { seen.speakShown = 1; await snap("speak-shown"); } await a.page.click('[data-act="ok"]'); }
      else break;
    }
    await a.page.goto(url, {waitUntil: "load"}); await snap("home-day1");
    await a.page.goto(url + "#/list", {waitUntil: "load"}); await a.page.waitForTimeout(150); await snap("list");
    await a.page.goto(url + "#/words", {waitUntil: "load"}); await a.page.waitForTimeout(150); await snap("words");
    await a.page.goto(url + "#/set", {waitUntil: "load"}); await a.page.waitForTimeout(150); await snap("set");
    await a.ctx.close();
    if (lateState) {
      const b = await newPage(browser, {width: w, height: h}, url, "2026-12-08T10:00:00", lateState);
      await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-home-1208.png"), fullPage: true});
      await setNow(b.page, "2026-12-11T10:00:00");
      await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-home-1211.png")});
      await b.page.goto(url + "#/plan", {waitUntil: "load"}); await b.page.waitForTimeout(150);
      await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-plan.png"), fullPage: true});
      await b.page.goto(url, {waitUntil: "load"}); await setNow(b.page, "2026-12-08T10:00:00");
      await b.page.goto(url + "#/free", {waitUntil: "load"}); await b.page.waitForTimeout(150);
      await b.page.click('[data-act="fr"][data-k="essay"]'); await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-essay0.png")});
      await b.page.click('[data-act="e-start"]'); await b.page.waitForTimeout(1300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-essay1.png")});
      await b.page.click('[data-act="e-done"]'); await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-essay2.png"), fullPage: true});
      await b.page.click('[data-act="ok"]');
      await b.page.goto(url + "#/free", {waitUntil: "load"}); await b.page.waitForTimeout(150);
      await b.page.click('[data-act="fr"][data-k="asm"]'); await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-pick.png")});
      await b.page.goto(url + "#/exam", {waitUntil: "load"}); await b.page.waitForTimeout(150); await b.page.waitForTimeout(300); await b.page.screenshot({path: path.join(SHOTS, name + "-" + label + "-exam.png")});
      await b.ctx.close();
    }
  }
}

async function testAudio(browser, url) {
  const data = fs.readFileSync(path.join(SITE, "data.js"), "utf8");
  const hs = [...new Set((data.match(/"auk?":"([0-9a-f]+)"/g) || []).map(x => x.replace(/^"auk?":"/, "").replace(/"$/, "")))];
  const pkm = data.match(/"pk":(\{"i":\{.*?\}\})/);
  if (pkm) {   // 미리 보기 판: 음성이 묶음 파일(audio/p번호.mp3)에 들어 있음
    const idx = JSON.parse(pkm[1]).i, size = {};
    const bad = hs.filter(h => {
      const x = idx[h];
      if (!x) return true;
      const p = path.join(SITE, "audio", "p" + x[0] + ".mp3");
      if (!(x[0] in size)) size[x[0]] = fs.existsSync(p) ? fs.statSync(p).size : -1;
      return x[2] < 1500 || x[1] + x[2] > size[x[0]];
    });
    ok(bad.length === 0, "음성 묶음에 빠진 것 0 (참조 " + hs.length + "개 · 묶음 " + Object.keys(size).length + "개)", "없음 " + bad.length);
    if (bad.length) return;
  } else {
    const missing = hs.filter(h => !fs.existsSync(path.join(SITE, "audio", h + ".mp3")) || fs.statSync(path.join(SITE, "audio", h + ".mp3")).size < 1500);
    ok(missing.length === 0, "음성 파일 누락 0 (참조 " + hs.length + "개)", "없음 " + missing.length);
    const extra = fs.readdirSync(path.join(SITE, "audio")).filter(f => f.endsWith(".mp3") && hs.indexOf(f.slice(0, -4)) < 0);
    ok(extra.length === 0, "안 쓰는 음성 파일 0", extra.length + "개");
    if (missing.length) return;
  }
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url + "#/u/b1", START + "T10:00:00");
  await page.click('.sent [data-act="play"]');
  const playing = await page.evaluate(() => new Promise(res => { let n = 0; const t = setInterval(() => { const a = document.querySelector("audio"); n++; if (n > 40) { clearInterval(t); res("timeout"); } }, 100); setTimeout(() => { clearInterval(t); res("checked"); }, 1500); }));
  ok(playing === "checked" && errs.length === 0, "문장 듣기 버튼 · 오류 0", errs.join("|"));
  await ctx.close();
}

async function testSW(browser, name) {
  // 서비스 워커: 한 번 연 뒤 음성을 전부 받아 두면 인터넷이 없어도(여기서는 서버를 꺼서) 열리고 소리가 남
  const own = await serve();
  const url = own.url;
  const {ctx, page, errs} = await newPage(browser, {width: 1180, height: 820}, url, START + "T10:00:00");
  const has = await page.evaluate(() => "serviceWorker" in navigator);
  if (!has) { console.log("  (" + name + ": 서비스 워커 없음 — 건너뜀)"); await ctx.close(); own.srv.close(); return; }
  try { await page.evaluate(() => navigator.serviceWorker.ready); } catch (e) {}
  await page.reload({waitUntil: "load"});
  const ctl = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok(ctl, name + " · 서비스 워커가 페이지를 맡음");
  await page.goto(url + "#/set", {waitUntil: "load"}); await page.waitForTimeout(150);
  await page.click('[data-act="dl"]');
  await page.waitForFunction(() => /다 받아 두었어요|받지 못한/.test(document.getElementById("dlmsg").textContent), null, {timeout: 120000});
  const msg = await page.$eval("#dlmsg", el => el.textContent);
  ok(/다 받아 두었어요/.test(msg), name + " · 음성 전부 받기", msg);
  await new Promise(r => { own.srv.closeAllConnections && own.srv.closeAllConnections(); own.srv.close(r); });
  await page.goto(url + "?offline=1", {waitUntil: "load"}).catch(() => {});
  const h1 = await page.evaluate(() => ((document.querySelector("header.top") || {}).textContent || "") + " / " + ((document.querySelector("h1") || {}).textContent || "")).catch(() => "(안 열림)");
  ok(/작문·면접/.test(h1) && / \/ ./.test(h1), name + " · 서버를 꺼도 다시 열림", h1);
  const played = await page.evaluate(async () => {
    const D = window.__sakubun.D, h = D.sents[D.units[0].s[0]].au;
    try { const r = await fetch("audio/" + h + ".mp3"); return r.ok ? (await r.blob()).size : -r.status; } catch (e) { return -1; }
  }).catch(() => -2);
  ok(played > 1500, name + " · 서버를 꺼도 음성 파일이 나옴", String(played));
  ok(errs.length === 0, name + " · 서비스 워커 시험 스크립트 오류 0", errs.slice(0, 3).join(" | "));
  await ctx.close();
}

(async () => {
  const {srv, url} = await serve();
  const engines = [["WebKit", () => pw.webkit.launch()], ["Chrome", () => pw.chromium.launch({channel: "chrome"})]];
  for (const [name, launch] of engines) {
    const browser = await launch();
    console.log("== " + name + " ==");
    let late = null;
    if (WHAT === "all" || WHAT === "course" || WHAT === "layout" || WHAT === "shots" || WHAT === "q") {
      // 12/7까지 표대로 진행한 상태를 뒤쪽 화면 검사에 씀
      const c = await newPage(browser, {width: 1180, height: 820}, url, START + "T10:00:00");
      await runDays(c.page, dayList(START, "2026-12-07"), 0.1, 11);
      late = await c.page.evaluate(() => localStorage.getItem("sakubun-v5"));
      await c.ctx.close();
    }
    if (WHAT === "all" || WHAT === "course") {
      const show = name === "WebKit";
      await testCourse(browser, url, 0.15, show);
      await testCourse(browser, url, 0, false);
      await testSlip(browser, url, "하루 밀림(12/1)", ["2026-12-01"], {blocks: "2026-12-04", all: "2026-12-09"}, show);
      await testSlip(browser, url, "이틀 밀림(11/30·12/1)", ["2026-11-30", "2026-12-01"], {blocks: "2026-12-04", all: "2026-12-09"}, show);
      await testSlip(browser, url, "하루 밀림(12/4)", ["2026-12-04"], {blocks: "2026-12-05", all: "2026-12-09"}, show);
      await testSlip(browser, url, "하루 밀림(12/6, JLPT 날)", ["2026-12-06"], {blocks: "2026-12-04", all: "2026-12-09"}, show);
      await testSlip(browser, url, "이틀 밀림(12/7·12/8)", ["2026-12-07", "2026-12-08"], {blocks: "2026-12-04", all: "2026-12-10"}, show);
      await testSlip(browser, url, "늦게 시작(12/3)", ["2026-11-30", "2026-12-01", "2026-12-02"], {blocks: "2026-12-04", all: "2026-12-09"}, show);
    }
    if (WHAT === "all" || WHAT === "resume") await testResume(browser, url);
    if (WHAT === "all" || WHAT === "q") await testQ(browser, url, late);
    if (WHAT === "all" || WHAT === "layout") await testLayout(browser, name, url, late);
    if (WHAT === "shots") await shots(browser, name, url, late);
    if (WHAT === "all" || WHAT === "audio") await testAudio(browser, url);
    if (WHAT === "all" || WHAT === "sw") await testSW(browser, name);
    await browser.close();
  }
  srv.close();
  console.log("\n통과 " + pass + " · 실패 " + fail);
  if (fail) { fails.forEach(f => console.log(" ✕ " + f)); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
