const CACHE = 'ichigo-beauty-shell-v13';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './firebase-auth.css',
  './app.js',
  './online.js',
  './product-guide.js',
  './product-specific.js',
  './usage-guide.js',
  './info-integrity.js',
  './photo-loader.js',
  './skincare-smart-sort.js',
  './skincare-view.js',
  './firebase-auth.js',
  './manifest.json',
  './icons/icon-192-v41.png',
  './icons/icon-512-v41.png',
  './icons/icon-maskable-512-v41.png',
  './icons/apple-touch-icon-v41.png'
];

const SHELL_FILES = new Set(['index.html','style.css','firebase-auth.css','app.js','online.js','product-guide.js','product-specific.js','usage-guide.js','info-integrity.js','photo-loader.js','skincare-smart-sort.js','skincare-view.js','firebase-auth.js','manifest.json']);

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

  // Third-party product APIs, Firebase SDK modules, auth traffic, and product images bypass the service worker.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || /\/(app|online|product-guide|product-specific|usage-guide|info-integrity|photo-loader|skincare-smart-sort|skincare-view|firebase-auth)\.js$/.test(url.pathname)) {
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
