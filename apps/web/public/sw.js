// Daydan service worker: the site keeps working offline for pages already opened.
// Pages (HTML) are network-first so a new deploy is seen at once; built assets and page
// images never change at a given URL, so they are served from the cache once fetched.
// Recitation audio comes from another origin and is left to the browser.
const CACHE = "daydan-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (request.mode === "navigate" ? await cache.match("/") : undefined);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const immutable = url.pathname.startsWith("/_next/static/") || /^\/p\/\d+\/[\w-]+\.png$/.test(url.pathname);
  event.respondWith(immutable ? cacheFirst(request) : networkFirst(request));
});
