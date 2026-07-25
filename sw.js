// Service Worker for PWA offline support and app-shell caching
const CACHE_VERSION = "voice-study-v1";
const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./record.html",
  "./lecture.html",
  "./css/style.css",
  "./img/herney.jpg",
  "./assets/manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-180.png",
  "./js/idb.js",
  "./js/groq-client.js",
  "./js/api.js",
  "./js/settings.js",
  "./js/sw-register.js",
  "./js/recorder.js",
  "./js/dashboard.js",
  "./js/lecture.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CACHE_ASSETS).catch(err => {
        console.warn("Some assets failed to cache:", err);
        // Continue even if some assets fail — offline support is best-effort
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache Groq API calls — always hit the network
  if (url.origin === "https://api.groq.com") {
    event.respondWith(fetch(request));
    return;
  }

  // Never cache external resources
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first strategy for same-origin requests (app shell)
  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          // Optionally cache successful responses for future offline use
          if (fetchResponse.ok) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return fetchResponse;
        }).catch(() => {
          // Return a fallback if offline and not in cache
          return caches.match(request) || new Response("Offline", { status: 503 });
        });
      })
    );
    return;
  }

  // For non-GET requests, go straight to network
  event.respondWith(fetch(request));
});
