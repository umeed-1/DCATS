/* DCATS service worker — offline-first app shell cache.
 * Bump CACHE whenever the precached shell changes (or the model is retrained);
 * the old cache is deleted on activate. Navigations are network-first so a
 * rebuilt bundle is always picked up when online, with the cached shell as the
 * offline fallback; hashed assets and the ONNX model are cache-first. */
const CACHE = 'dcats-v5';
const CORE = ['/', '/index.html', '/manifest.webmanifest'];

async function precacheBuild(cache) {
  await cache.addAll(CORE);
  const shell = await cache.match('/index.html');
  if (!shell) return;

  // Vite emits hashed JS/CSS names. Discover them from the shell at install
  // time so a fresh offline PWA load does not depend on a second online page
  // visit just to cache the application bundle.
  const html = await shell.text();
  const shellAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin).pathname)
    .filter((path) => path.startsWith('/assets/') || path.startsWith('/favicon'));
  await Promise.all(shellAssets.map((path) => cache.add(path).catch(() => {})));

  const discovered = new Set(shellAssets);
  for (let pass = 0; pass < 2; pass += 1) {
    // JS chunks reference the lazy ONNX bundle/wasm; the CSS bundle carries
    // the hashed @font-face woff2 URLs, so both must be scanned.
    const scanned = [...discovered].filter((path) => path.endsWith('.js') || path.endsWith('.css'));
    const referenced = new Set();
    for (const source of scanned) {
      const response = await cache.match(source);
      if (!response) continue;
      const text = await response.text();
      for (const match of text.matchAll(/(?:assets|models)\/[A-Za-z0-9._-]+\.(?:js|css|wasm|onnx|woff2|json)/g)) {
        referenced.add(`/${match[0]}`);
      }
    }
    const fresh = [...referenced].filter((path) => !discovered.has(path));
    if (!fresh.length) break;
    await Promise.all(fresh.map((path) => cache.add(path).catch(() => {})));
    fresh.forEach((path) => discovered.add(path));
  }

  // The ONNX runtime and model are optional at runtime, but this build ships
  // them. Pre-caching them makes the first post-install offline mission work;
  // the heuristic classifier remains available if either fetch is absent.
  await Promise.all([
    cache.add('/models/threat_classifier.onnx').catch(() => {}),
    cache.add('/models/threat_classifier.meta.json').catch(() => {}),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(precacheBuild).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // only cache the app's own bundle

  // Navigations: network-first (fresh bundle when online), cached shell offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Hashed assets / model: cache-first, populate on first fetch.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(
      (cached) =>
        cached ??
        fetch(event.request).then((res) => {
          if (!res.ok) return res;
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        }).catch(() => new Response('Offline asset is not cached yet.', {
          status: 504,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }))
      )
  );
});
