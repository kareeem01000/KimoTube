/* ============================================
   KimoTube - Service Worker v1.0.0
   ============================================ */

const CACHE_NAME = 'kimotube-v1';
const STATIC_CACHE_NAME = 'kimotube-static-v1';
const API_CACHE_NAME = 'kimotube-api-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles/style.css',
  './styles/animations.css',
  './styles/responsive.css',
  './styles/dark.css',
  './js/utils.js',
  './js/api.js',
  './js/download.js',
  './js/ui.js',
  './js/app.js',
  './assets/logo.svg',
  './assets/favicon.svg',
  './manifest.json'
];

const OFFLINE_URL = './offline/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('kimotube-') && name !== STATIC_CACHE_NAME;
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  if (url.origin === 'https://api.cobalt.tools') {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(API_CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response(
            JSON.stringify({ error: 'You are offline. Please check your connection.' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        });
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/assets/') || url.pathname.includes('/styles/') || url.pathname.includes('/js/')) {
      event.respondWith(
        caches.match(request).then((cached) => {
          return cached || fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          });
        })
      );
      return;
    }

    if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
      event.respondWith(
        caches.match(request).then((cached) => {
          return cached || fetch(request);
        })
      );
      return;
    }
  }

  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
