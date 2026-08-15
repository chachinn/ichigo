const CACHE = 'ichigo-beauty-shell-v4';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './online.js',
  './manifest.json',
  './icons/icon-192-v41.png',
  './icons/icon-512-v41.png',
  './icons/icon-maskable-512-v41.png',
  './icons/apple-touch-icon-v41.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Live product lookup and every other third-party request must stay network-only.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation and app scripts are network-first so installed iPhones recover from bad/stale builds quickly.
  if (req.mode === 'navigate' || /\/(app|online)\.js$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req.mode === 'navigate' ? './index.html' : req, copy));
          }
          return res;
        })
        .catch(() => req.mode === 'navigate' ? caches.match('./index.html') : caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
