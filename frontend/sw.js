// ═══════════════════════════════════════════════════════════
// Service Worker — HF Controll v2
// Mude a versão abaixo a cada deploy para limpar cache antigo
// ═══════════════════════════════════════════════════════════
const CACHE_VERSION = "hf-controll-v2.0";
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// Arquivos que sempre ficam em cache (shell do app)
const STATIC_ASSETS = [
  "/login.html",
  "/dashboard.html",
  "/style.css",
  "/auth.css",
  "/rancho.js",
  "/dashboard_parts/api.js",
  "/manifest.json",
];

// URLs que NUNCA devem ser cacheadas (sempre busca na rede)
const NEVER_CACHE = ["/api/", "/api/auth/", "/api/gestao/", "/api/dashboard/"];

// ── Instalação: cacheia os arquivos estáticos ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log("[SW] Cacheando arquivos estáticos...");
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  // Força o novo SW a ativar imediatamente sem esperar abas fecharem
  self.skipWaiting();
});

// ── Ativação: limpa caches antigos de versões anteriores ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Remove qualquer cache que não seja da versão atual
            return (
              name.startsWith("hf-controll-") &&
              name !== CACHE_STATIC &&
              name !== CACHE_DYNAMIC
            );
          })
          .map((name) => {
            console.log(`[SW] Removendo cache antigo: ${name}`);
            return caches.delete(name);
          }),
      );
    }),
  );
  // Assume controle de todas as abas abertas imediatamente
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de requisição ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET
  if (request.method !== "GET") return;

  // Ignora extensões de browser e chrome-extension
  if (!url.protocol.startsWith("http")) return;

  // ── API: sempre busca na rede (nunca cacheia) ──
  const isApi = NEVER_CACHE.some((path) => url.pathname.startsWith(path));
  if (isApi) {
    event.respondWith(
      fetch(request).catch(() => {
        // Se offline e é API, retorna erro JSON amigável
        return new Response(
          JSON.stringify({ error: "Sem conexão. Verifique sua internet." }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    return;
  }

  // ── Arquivos estáticos: Cache First (serve cache, atualiza em background) ──
  const isStatic = STATIC_ASSETS.some(
    (asset) => url.pathname === asset || url.pathname.endsWith(asset),
  );
  if (isStatic) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        // Busca atualização em background mesmo servindo do cache
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        return cached || fetchPromise;
      }),
    );
    return;
  }

  // ── CDN externos (Bootstrap, FontAwesome, etc): Cache First ──
  const isCDN = url.origin !== location.origin;
  if (isCDN) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
      }),
    );
    return;
  }

  // ── Demais requisições: Network First (tenta rede, fallback cache) ──
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          caches
            .open(CACHE_DYNAMIC)
            .then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response("Offline", { status: 503 });
      }),
  );
});

// ── Mensagens do cliente (força atualização manual) ──
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
