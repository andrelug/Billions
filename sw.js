// Offline support: precache the app shell, then cache everything else
// (sprites, data) the first time it is fetched.
const CACHE = 'billions-v4';
const SHELL = ['./', './index.html', './css/style.css', './manifest.webmanifest', './js/main.js', './assets/manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
// Code, styles and data always revalidate with the server. Otherwise the
// browser's HTTP cache can hand back an old module next to a new one after a
// deploy, and the game fails to start. Art keeps the normal HTTP cache.
const FRESH = /(\/|\.(m?js|css|json|webmanifest|html))$/;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const fresh = req.mode === 'navigate' || FRESH.test(url.pathname);
  // Network first so updates (and new art) show up; fall back to cache offline.
  e.respondWith(fetch(req, fresh ? { cache: 'no-cache' } : undefined).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
