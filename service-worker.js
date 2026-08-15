const CACHE = 'ichigo-beauty-shell-v10';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './online.js',
  './product-guide.js',
  './product-specific.js',
  './usage-guide.js',
  './info-integrity.js',
  './photo-loader.js',
  './manifest.json',
  './icons/icon-192-v41.png',
  './icons/icon-512-v41.png',
  './icons/icon-maskable-512-v41.png',
  './icons/apple-touch-icon-v41.png'
];

const SHELL_FILES = new Set(['index.html','style.css','app.js','online.js','product-guide.js','product-specific.js','usage-guide.js','info-integrity.js','photo-loader.js','manifest.json']);

function shellFallback(url) {
  const file = url.pathname.split('/').pop() || 'index.html';
  return SHELL_FILES.has(file) ? caches.match('./' + file) : Promise.resolve(undefined);
}

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

  // Do not proxy third-party product APIs or product images through the service worker.
  // Let the browser request them directly; this is more reliable on installed iOS PWAs.
  if (url.origin !== self.location.origin) return;

  // Navigation and app scripts are network-first so installed iPhones recover from bad/stale builds quickly.
  if (req.mode === 'navigate' || /\/(app|online|product-guide|product-specific|usage-guide|info-integrity|photo-loader)\.js$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req.mode === 'navigate' ? './index.html' : req, copy));
          }
          return res;
        })
        .catch(async () => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return (await caches.match(req)) || shellFallback(url);
        })
    );
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req) || await shellFallback(url);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return res;
  })());
});
