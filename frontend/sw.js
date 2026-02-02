const CACHE_NAME = "rancho-v1";
const ASSETS = [
  "/",
  "/dashboard.html",
  "/login.html",
  "/style.css",
  "/rancho.js",
  "/dashboard_parts/api.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
];

// Instalação: Cacheia os arquivos estáticos
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// Fetch: Serve o cache se estiver offline, senão busca na rede
self.addEventListener("fetch", (e) => {
  // Apenas cacheia requisições GET (ignora POST/PUT de dados)
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    }),
  );
});
