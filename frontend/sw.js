// ═══════════════════════════════════════════════════════════
// Service Worker — HF Controll v4.0
// ═══════════════════════════════════════════════════════════
const CACHE_VERSION = "hf-controll-v2.5";
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_API = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  "/login.html",
  "/dashboard.html",
  "/style.css",
  "/auth.css",
  "/rancho.js",
  "/dashboard_parts/api.js",
  "/manifest.json",
];

const API_CACHEABLE = [
  "/api/dashboard/kpis",
  "/api/dashboard/alertas",
  "/api/dashboard/ocupacao",
  "/api/dashboard/cobrancas",
  "/api/gestao/cavalos",
  "/api/gestao/proprietarios",
  "/api/gestao/perfil",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (n) =>
                n.startsWith("hf-controll-") &&
                ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_API].includes(n),
            )
            .map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // APIs cacheáveis — Stale-While-Revalidate
  const isApiCacheable = API_CACHEABLE.some((p) => url.pathname.startsWith(p));
  if (isApiCacheable) {
    e.respondWith(
      caches.open(CACHE_API).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchP = fetch(request)
          .then((res) => {
            if (res?.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return (
          cached ||
          fetchP ||
          new Response(JSON.stringify({ error: "Sem conexão." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        );
      }),
    );
    return;
  }

  // Outras APIs — sempre rede
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "Sem conexão." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  // Estáticos — Cache First
  const isStatic = STATIC_ASSETS.some(
    (a) => url.pathname === a || url.pathname.endsWith(a),
  );
  if (isStatic) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchP = fetch(request)
          .then((res) => {
            if (res?.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || fetchP;
      }),
    );
    return;
  }

  // CDN — Cache First
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(CACHE_DYNAMIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            if (res?.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
      }),
    );
    return;
  }

  // Resto — Network First
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res?.status === 200)
          caches.open(CACHE_DYNAMIC).then((c) => c.put(request, res.clone()));
        return res;
      })
      .catch(
        async () =>
          (await caches.match(request)) ||
          new Response("Offline", { status: 503 }),
      ),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "CLEAR_API_CACHE") caches.delete(CACHE_API);
});
