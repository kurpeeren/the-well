self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName); // Delete all old caches
        })
      );
    }).then(() => {
      self.clients.claim(); // Claim control immediately
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Bypass cache completely and fetch from network
  event.respondWith(fetch(event.request));
});
