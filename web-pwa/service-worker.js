// service-worker.js
const CACHE = "app-v3";
const ASSETS = [
  "./",                    // raíz
  "./index.html",
  "./scanner.html",
  "./css/style.css",
  "./js/app.js",
  "./js/scanner.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 1) Nunca interceptar POST ni llamadas a API (alumnos/asistencias)
  const isAPI = /\/(alumnos|asistencias)\b/.test(url.pathname);
  if (req.method !== "GET" || isAPI) {
    return; // deja pasar a la red tal cual
  }

  // 2) HTML -> network-first (para no quedar con JS viejo y que falle la cámara)
  const isHTML =
    url.origin === self.location.origin &&
    (url.pathname === "/" ||
     url.pathname.endsWith("/index.html") ||
     url.pathname.endsWith("/scanner.html"));
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 3) Resto de assets propios -> cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // 4) Recursos externos (CDN, etc.) -> network con fallback a cache
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
