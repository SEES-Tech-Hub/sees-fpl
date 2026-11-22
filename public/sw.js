// SEES Games Hub service worker. Owner: Samuel (PWA, push).
//
// It caches ONLY the app shell, never live data:
//   - Page navigations always go to the network. If the network fails, the
//     cached /offline page is shown instead. Page HTML is never cached, so a
//     score can never be shown stale.
//   - /_next/static/* files have a content hash in their name, so a cached copy
//     is never out of date. They are served from the cache first, which makes
//     repeat visits fast on poor signal.
//   - The offline page, its CSS, JS and fonts, the manifest and the icons are
//     cached when the worker installs.
//   - Everything else (Supabase data, auth, Realtime, server actions, RSC
//     payloads, POSTs, other sites) is left alone: the browser handles it as
//     if there were no service worker.
//
// When you change what this file caches, bump SHELL_VERSION so phones drop the
// old cache. Push handlers will be added here in the push task.

const SHELL_VERSION = "v1";
const SHELL_CACHE = `sees-shell-${SHELL_VERSION}`;
const STATIC_CACHE = "sees-static";
const STATIC_CACHE_LIMIT = 120;
const OFFLINE_URL = "/offline";

const SHELL_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Paths of the hashed build files a page needs (CSS, JS chunks, fonts).
// The RSC payload escapes quotes with backslashes, so stop at those too.
const STATIC_ASSET_PATTERN = /\/_next\/static\/[^"'\s\\()<>]+/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: "reload" })));

      // Cache what the offline page needs to render, so it is styled offline.
      // These live in the shell cache, which is never trimmed.
      const offline = await cache.match(OFFLINE_URL);
      if (offline) {
        const html = await offline.text();
        const assets = [...new Set(html.match(STATIC_ASSET_PATTERN) ?? [])];
        await Promise.all(
          assets.map(async (path) => {
            const response = await fetch(path);
            if (response.ok) await cache.put(path, response);
          }),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("sees-shell-") && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOrOfflinePage(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (SHELL_URLS.includes(url.pathname) && url.pathname !== OFFLINE_URL) {
    event.respondWith(shellFirst(request));
  }
  // Anything else: no respondWith, so the browser fetches it normally.
});

async function networkOrOfflinePage(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    return offline ?? Response.error();
  }
}

async function cacheFirst(request) {
  // Look in every cache: the offline page's own files sit in the shell cache.
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    trimCache(cache, STATIC_CACHE_LIMIT);
  }
  return response;
}

async function shellFirst(request) {
  const cached = await caches.match(request, { cacheName: SHELL_CACHE });
  return cached ?? fetch(request);
}

// Old build files pile up across deploys; drop the oldest beyond the limit.
async function trimCache(cache, limit) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    await cache.delete(key);
  }
}
