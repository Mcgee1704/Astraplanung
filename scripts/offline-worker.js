// The build declares buildId and shellPaths immediately before this code.
const scope = new URL(self.registration.scope);
const cachePrefix = 'astraplanung-shell-' + encodeURIComponent(scope.href) + '-';
const cacheName = cachePrefix + buildId;
const indexURL = new URL('index.html', scope).href;
const shellURLs = new Set(shellPaths.map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const files = Array.from(shellURLs, (url) => new Request(url, { cache: 'reload' }));
    await cache.addAll(files);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous = keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName);
    await Promise.all(previous.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin) return;
  const pathURL = url.origin + url.pathname;
  const key = event.request.mode === 'navigate' && url.pathname === scope.pathname
    ? indexURL
    : pathURL;
  if (!shellURLs.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // Module and stylesheet requests may send different Origin headers from precaching.
    // Only the known, public files in this version of the application share these responses.
    const found = await cache.match(key, { ignoreVary: true });
    return found || fetch(event.request);
  })());
});
