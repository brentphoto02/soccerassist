const CACHE_NAME = 'soccer-assist-cache-v3';
const OFFLINE_URL = 'offline.html';
const urlsToCache = [
  'index.html',
  'style.css',
  'app.js',
  'icons/icon-192x192.svg',
  'icons/icon-512x512.svg',
  'assets/player-home.svg',
  'assets/player-opponent.svg',
  'assets/soccer-ball.svg',
  'assets/soccer-ball.png',
  'assets/cone.svg',
  'manifest.json',
  OFFLINE_URL
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Take control immediately after install
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)));
      // Prefetch latest core assets for speed
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        urlsToCache.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (e) {}
        })
      );
    })()
  );
  // Claim clients immediately so updates apply without reload races
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Dynamically generate PNG icons if requested
  if (url.pathname.endsWith('/icons/icon-192x192.png')) {
    event.respondWith(generateIconPng(192));
    return;
  }
  if (url.pathname.endsWith('/icons/icon-512x512.png')) {
    event.respondWith(generateIconPng(512));
    return;
  }
  if (url.pathname.endsWith('/icons/icon-maskable-512.png')) {
    event.respondWith(generateIconPng(512, true));
    return;
  }
  // For navigation requests, try network first, fall back to cache, then offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('index.html');
        return cached || cache.match(OFFLINE_URL);
      })
    );
    return;
  }

  // For same-origin GET requests, use stale-while-revalidate for snappier loads
  if (req.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: network fallback to cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || fetchPromise || caches.match(OFFLINE_URL);
}

async function generateIconPng(size, maskable = false) {
  try {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, size, size);
    const pad = maskable ? Math.floor(size * 0.08) : 0;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(size * 0.5)}px Arial, Helvetica, sans-serif`;
    ctx.fillText('SA', size / 2, size / 2 + (maskable ? Math.floor(size * 0.02) : 0));
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Response(blob, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' } });
  } catch (e) {
    const path = size >= 512 ? 'icons/icon-512x512.svg' : 'icons/icon-192x192.svg';
    const cached = await caches.match(path);
    if (cached) return cached;
    return fetch(path);
  }
}
