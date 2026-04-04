const CACHE_NAME = 'refundguardian-ai-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, '/']);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })()
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (_error) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        const accept = event.request.headers.get('accept') || '';
        if (accept.includes('text/html')) {
          const offlineResponse = await cache.match(OFFLINE_URL);
          if (offlineResponse) return offlineResponse;
          const shell = await cache.match('/');
          if (shell) return shell;
        }

        // Avoid uncaught rejections in respondWith when offline / dev server hiccups.
        return new Response('', { status: 503, statusText: 'Network unavailable' });
      }
    })()
  );
});

