// Service worker (scope /gtb/), registered by src/serviceWorker.js in the built game.
// - media/ and tiles/ files that carry ?v= (the game versions them: tiles by the map index,
//   media by the shipped content hash) → from the device's cache first; a new version of a
//   file replaces the old copy. Repeat visits load the map and textures without the network.
// - The page itself (navigations) → always from the network, revalidated: the HTML names
//   the hashed JavaScript files of the current deploy, so it must never be stale.
// - Everything else → straight to the network, as without a service worker.
// Kill switch: if this ever misbehaves, deploy a sw.js that calls self.registration.unregister().
const CACHE = 'gtb-files-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (req.mode === 'navigate') { event.respondWith(page(req)); return; }
  const rel = url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : '';
  if (url.searchParams.has('v') && /^(media|tiles)\//.test(rel)) event.respondWith(versioned(req, event));
});

async function versioned(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) {
    const copy = res.clone();
    // One copy per file: drop older versions (same path, other ?v=), then store this one.
    event.waitUntil(cache.delete(req, { ignoreSearch: true }).then(() => cache.put(req, copy)).catch(() => {}));
  }
  return res;
}

async function page(req) {
  const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => null);
  // Redirects (and failures) go back to the browser's own handling.
  if (!res || res.redirected) return fetch(req);
  return res;
}
