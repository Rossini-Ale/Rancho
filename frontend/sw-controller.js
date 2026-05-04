// ═══════════════════════════════════════════════════════════
// sw-controller.js — Controle do Service Worker
// Inclua este script no final do dashboard.html e login.html
// <script src="sw-controller.js"></script>
// ═══════════════════════════════════════════════════════════

(function () {
  if (!("serviceWorker" in navigator)) return;

  // ── Registra o SW ──
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      // Verifica se há uma atualização disponível
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        newWorker.addEventListener("statechange", () => {
          // Novo SW instalado e pronto — mostra banner de atualização
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            mostrarBannerAtualizacao(newWorker);
          }
        });
      });
    })
    .catch((err) => console.log("[SW] Erro ao registrar:", err));

  // Quando o SW assume controle, recarrega a página automaticamente
  let atualizando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!atualizando) {
      atualizando = true;
      window.location.reload();
    }
  });

  // ── Banner de nova versão disponível ──
  function mostrarBannerAtualizacao(newWorker) {
    // Evita duplicar o banner
    if (document.getElementById("swUpdateBanner")) return;

    const banner = document.createElement("div");
    banner.id = "swUpdateBanner";
    banner.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #3D1E0A;
      color: #E8C97A;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 0.82rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999;
      white-space: nowrap;
      font-family: 'DM Sans', sans-serif;
      animation: slideUp 0.3s ease;
    `;
    banner.innerHTML = `
      <i class="fa-solid fa-rotate" style="font-size:0.9rem;"></i>
      Nova versão disponível!
      <button onclick="atualizarApp()" style="
        background: #E8C97A;
        color: #3D1E0A;
        border: none;
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
      ">Atualizar</button>
    `;

    // Adiciona animação CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Expõe função de atualização globalmente
    window.atualizarApp = function () {
      newWorker.postMessage("SKIP_WAITING");
      banner.remove();
    };

    // Remove o banner automaticamente após 15 segundos
    setTimeout(() => banner?.remove(), 15000);
  }

  // ── Detecção de Offline/Online ──
  let offlineBanner = null;

  function mostrarOffline() {
    if (offlineBanner) return;
    offlineBanner = document.createElement("div");
    offlineBanner.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #5C1A1A;
      color: #FFB3B3;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: 'DM Sans', sans-serif;
    `;
    offlineBanner.innerHTML = `<i class="fa-solid fa-wifi-slash"></i> Sem conexão`;
    document.body.appendChild(offlineBanner);
  }

  function esconderOffline() {
    if (offlineBanner) {
      offlineBanner.remove();
      offlineBanner = null;

      // Mostra toast de reconexão se RanchoApp estiver disponível
      if (typeof RanchoApp !== "undefined" && RanchoApp.mostrarNotificacao) {
        RanchoApp.mostrarNotificacao("Conexão restaurada!");
      }
    }
  }

  window.addEventListener("offline", mostrarOffline);
  window.addEventListener("online", esconderOffline);

  // Checa estado inicial
  if (!navigator.onLine) mostrarOffline();
})();
