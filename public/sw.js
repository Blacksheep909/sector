/* SECTOR — service worker: makes the game installable as an app, and loads it fast.
   Network first (the game updates often), with the last copy as a fallback if the server can't be reached.
   Live play goes over the WebSocket, which a service worker never touches; server APIs are passed straight through. */
const CACHE = 'sector-shell-v1';
const PASS = /^\/(auth|host|dev|info|news|lan)\b/;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || PASS.test(url.pathname)) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
