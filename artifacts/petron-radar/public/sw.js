const CACHE = 'petron-radar-v2';

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {}),
    ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (
    e.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return r;
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match('/')),
        ),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((r) => {
          if (r.ok && r.type === 'basic') {
            const clone = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return r;
        }),
    ),
  );
});
