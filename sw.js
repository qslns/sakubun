/* 작문·면접 드릴 — 오프라인 저장. 페이지·자료는 네트워크 먼저(새 판이 바로 보이게), 음성·글꼴은 저장본 먼저. */
const VERSION = "c37ed82729";
const SHELL = "sakubun-shell-" + VERSION;
const AUDIO = "sakubun-audio-1";
const FONTS = "sakubun-fonts-1";
const FILES = ["./", "./index.html", "./app.js?v=" + VERSION, "./data.js?v=" + VERSION];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("sakubun-shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(name, req) {
  return caches.open(name).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) { try { c.put(req.url, res.clone()); } catch (err) {} }
    return res;
  })));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (/\/audio\/[0-9a-f]+\.mp3$/.test(url.pathname)) { e.respondWith(cacheFirst(AUDIO, req)); return; }
    if (/version\.json$/.test(url.pathname)) return;
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req.url, copy)); }
        return res;
      }).catch(() => caches.match(req.url).then(r => r || caches.match(req.url, {ignoreSearch: true}))
        .then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
    );
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(FONTS, req));
  }
});
