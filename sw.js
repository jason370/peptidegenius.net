/* PeptideGenius service worker — minimal, safe, versioned.
   Strategy:
   - Navigations (the HTML shell): network-first, cached copy as offline fallback.
     HTML is the version pointer, so it must always try the network first.
   - Same-origin /assets/*: cache-first. Asset URLs are cache-busted with ?v=,
     so a cached entry is immutable by construction.
   - /api/* and cross-origin: never touched — pass straight through.
   Bump SW_VERSION on release to drop old caches (activate cleans up).
   The in-app "Reset & reload" button unregisters this worker entirely. */
const SW_VERSION = 'tmp-sw-v2-20260714-saline';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SW_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // cross-origin & POSTs: untouched
  if (url.pathname.startsWith('/api/')) return; // tracking proxy: never cached

  // HTML shell: network-first so new releases arrive immediately; cache fallback = offline support
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(SW_VERSION).then((c) => c.put('/', copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Assets: cache-first (URLs are ?v= cache-busted, so cached = correct)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(SW_VERSION).then((c) => c.put(e.request, copy)).catch(() => {}); }
        return r;
      }))
    );
  }
});
