/* Ichigo Build 2 — Offline App Shell */
const CACHE_NAME = "ichigo-build2-v5-data-folder";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data/data.js",
  "./data/db.js",
  "./manifest.json",
  "./manifest.json?v=20260811-iconfix1",
  "./icons/icon-192.png",
  "./icons/icon-192.png?v=20260811-iconfix1",
  "./icons/icon-512.png",
  "./icons/icon-512.png?v=20260811-iconfix1",
  "./icons/icon-maskable-512.png",
  "./icons/icon-maskable-512.png?v=20260811-iconfix1",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon.png?v=20260811-iconfix1"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("ichigo-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isIcon = url.pathname.includes("/icons/");
  const isManifest = url.pathname.endsWith("/manifest.json");

  /* Icons and manifest are network-first so iOS is less likely to keep
     an old Home Screen icon after an update. */
  if (isIcon || isManifest) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(event.request)) ||
                 (await caches.match(event.request, { ignoreSearch: true }));
        })
    );
    return;
  }

  /* Navigations are network-first with an offline fallback. */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* Other local app assets are cache-first. */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});