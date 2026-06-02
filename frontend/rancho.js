const RanchoApp = {
  // ── Estado ──
  _cache: {},
  bsModalProp: null,
  bsModalCavalo: null,
  bsModalFin: null,
  bsModalMensalidade: null,
  bsModalDetalhesProp: null,
  bsModalConfig: null,
  bsToast: null,
  bsModalConfirm: null,
  bsModalPerfil: null,
  nomeUsuario: "",
  nomeRancho: "",
  deferredPrompt: null,
  chartHistorico: null,
  chartFinanceiro: null,
  chartRancho: null,
  chartTendencia: null,
  chartHistoricoCliente: null,
  dataFiltro: new Date(),
  dataFiltroProp: new Date(),
  dataFiltroRancho: new Date(),
  abaAtual: "home",
  proprietarioAtualId: null,
  categoriaFiltroRancho: "",
  statusFiltroAnimais: "",
  chavePixCache: "",

  // ── Init ──
  async init() {
    const ids = ["modalProprietario","modalCavalo","modalFinanceiro","modalMensalidade","modalDetalhesProprietario","modalConfirmacao","modalConfig"];
    const [prop, cav, fin, mens, detProp, conf, cfg] = ids.map((id) => new bootstrap.Modal(document.getElementById(id)));
    this.bsModalProp = prop;
    this.bsModalCavalo = cav;
    this.bsModalFin = fin;
    this.bsModalMensalidade = mens;
    this.bsModalDetalhesProp = detProp;
    this.bsModalConfirm = conf;
    this.bsModalConfig = cfg;

    const te = document.getElementById("liveToast");
    if (te) this.bsToast = new bootstrap.Toast(te);

    this.initDarkMode();
    this.setupPullToRefresh();
    this._setupSwipeTabs();
    this.setupPWA();
    this.setupListeners();
    this.setupBuscaGlobal();
    this._tratarShortcuts();

    await this.carregarUsuario();
    await this.carregarConfiguracoes();
    await this.carregarProprietariosSelect();
    await this.carregarHome();
  },

  async carregarUsuario() {
    try {
      const perfil = await ApiService.fetchData("/api/gestao/perfil");
      if (!perfil) return;
      this.nomeUsuario = perfil.nome || "";
      this.nomeRancho = perfil.nome_rancho || "HF Controll";
      this.chavePixCache = perfil.chave_pix || "";
      this._aplicarPerfil();
    } catch (e) {}
  },

  _aplicarPerfil() {
    const primeiroNome = this.nomeUsuario.split(" ")[0];
    const iniciais = this._gerarIniciais(this.nomeUsuario);
    const nomeRancho = this.nomeRancho || "HF Controll";

    const navAv = document.getElementById("navbarAvatar");
    if (navAv) navAv.textContent = iniciais;
    const brand = document.getElementById("brandName");
    if (brand) brand.textContent = nomeRancho;

    const sideNome = document.getElementById("sidebarNomeUsuario");
    if (sideNome) sideNome.textContent = primeiroNome || "Usuário";
    const sideAv = document.getElementById("sidebarAvatar");
    if (sideAv) sideAv.textContent = iniciais;
    const sideRancho = document.getElementById("sidebarRanchoNome");
    if (sideRancho) sideRancho.textContent = nomeRancho;
    const sideBrand = document.getElementById("sidebarBrandName");
    if (sideBrand) sideBrand.textContent = nomeRancho;

    const topAv = document.getElementById("topbarAvatar");
    if (topAv) topAv.textContent = iniciais;
  },

  _gerarIniciais(nome) {
    if (!nome) return "HF";
    const p = nome.trim().split(" ").filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return p[0].substring(0, 2).toUpperCase();
  },

  // ── Modal de Perfil ──
  async abrirModalPerfil() {
    this.vibrar();
    if (!this.bsModalPerfil) this.bsModalPerfil = new bootstrap.Modal(document.getElementById("modalPerfil"));
    document.getElementById("perfilNome").value = this.nomeUsuario || "";
    document.getElementById("perfilNomeRancho").value = this.nomeRancho || "";
    document.getElementById("perfilChavePix").value = this.chavePixCache || "";
    document.getElementById("perfilTelefone").value = "";
    try {
      const p = await ApiService.fetchData("/api/gestao/perfil");
      if (p?.telefone) document.getElementById("perfilTelefone").value = p.telefone;
    } catch (e) {}
    this.atualizarPreviaPerifil();
    this.bsModalPerfil.show();
    const form = document.getElementById("formPerfil");
    const novo = form.cloneNode(true);
    form.parentNode.replaceChild(novo, form);
    document.getElementById("formPerfil").addEventListener("submit", (e) => this.salvarPerfil(e));
    document.getElementById("perfilNome").addEventListener("input", () => this.atualizarPreviaPerifil());
    document.getElementById("perfilNomeRancho").addEventListener("input", () => this.atualizarPreviaPerifil());
    document.getElementById("perfilTelefone").addEventListener("input", (e) => this.mascaraTelefone(e));
  },

  atualizarPreviaPerifil() {
    const nome = document.getElementById("perfilNome")?.value.trim() || "Usuário";
    const rancho = document.getElementById("perfilNomeRancho")?.value.trim() || "HF Controll";
    const primeiroNome = nome.split(" ")[0];
    const iniciais = this._gerarIniciais(nome);
    const h = new Date().getHours();
    const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const av = document.getElementById("perfilAvatar");
    const nm = document.getElementById("perfilNomePrevia");
    const rc = document.getElementById("perfilRanchoPrevia");
    const pt = document.getElementById("perfilPreviaTexto");
    const pa = document.getElementById("perfilPreviaAvatar");
    const pr = document.getElementById("perfilPreviaRancho");
    if (av) av.textContent = iniciais;
    if (nm) nm.textContent = nome;
    if (rc) rc.textContent = rancho;
    if (pt) pt.textContent = `${periodo}, ${primeiroNome}!`;
    if (pa) pa.textContent = iniciais;
    if (pr) pr.textContent = rancho;
  },

  async salvarPerfil(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSalvarPerfil");
    this.setLoading(btn, true, "Salvando...");
    const body = {
      nome: document.getElementById("perfilNome").value.trim(),
      nome_rancho: document.getElementById("perfilNomeRancho").value.trim(),
      chave_pix: document.getElementById("perfilChavePix").value.trim(),
      telefone: document.getElementById("perfilTelefone").value.trim(),
    };
    try {
      await ApiService.putData("/api/gestao/perfil", body);
      this.nomeUsuario = body.nome;
      this.nomeRancho = body.nome_rancho;
      this.chavePixCache = body.chave_pix;
      this._aplicarPerfil();
      this.setDataHoje();
      this.bsModalPerfil.hide();
      this.mostrarNotificacao("Perfil salvo!");
    } catch (e) {
      this.mostrarNotificacao("Erro ao salvar perfil.", "erro");
    } finally {
      this.setLoading(btn, false, '<i class="fa-solid fa-floppy-disk me-2"></i>Salvar perfil');
    }
  },

  // ── Dark Mode ──
  initDarkMode() {
    const aplicarTema = (dark) => {
      document.body[dark ? "setAttribute" : "removeAttribute"]("data-theme", "dark");
      localStorage.setItem("theme", dark ? "dark" : "light");
      ["btnDarkMode","btnDarkModeDesktop","btnDarkModeSidebar"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const i = btn.querySelector("i");
        if (i) { i.classList.remove("fa-moon", "fa-sun"); i.classList.add(dark ? "fa-sun" : "fa-moon"); }
        const span = btn.querySelector("span");
        if (span) span.textContent = dark ? "Modo claro" : "Modo escuro";
      });
    };

    if (localStorage.getItem("theme") === "dark") aplicarTema(true);

    const bindBtns = () => {
      ["btnDarkMode","btnDarkModeDesktop","btnDarkModeSidebar"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn || btn._darkBound) return;
        btn._darkBound = true;
        btn.addEventListener("click", () => { this.vibrar(); const dark = document.body.getAttribute("data-theme") === "dark"; aplicarTema(!dark); });
      });
    };
    bindBtns();
    if (document.readyState !== "complete") window.addEventListener("load", bindBtns);
    setTimeout(bindBtns, 300);
  },

  // ── Pull to Refresh ──
  setupPullToRefresh() {
    let startY = 0, currentY = 0, isPulling = false, startX = 0;
    const ptr = document.getElementById("ptrIndicator");

    document.addEventListener("touchstart", (e) => {
      const modalAberto = document.querySelector(".modal.show");
      if (modalAberto) return;
      if (e.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      isPulling = true;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!isPulling) return;
      currentY = e.touches[0].clientY;
      const dy = currentY - startY;
      const dx = Math.abs(e.touches[0].clientX - startX);
      if (dx > 20) { isPulling = false; return; }
      if (dy > 0 && !window.scrollY) {
        if (e.cancelable) e.preventDefault();
        ptr.style.transform = `translateY(${Math.min(dy / 2, 70)}px)`;
        ptr.style.opacity = Math.min(dy / 100, 1);
      } else {
        isPulling = false;
        ptr.style.transform = "translateY(-50px)";
        ptr.style.opacity = 0;
      }
    }, { passive: false });

    document.addEventListener("touchend", async () => {
      if (!isPulling) return;
      isPulling = false;
      const d = currentY - startY;
      if (d > 120) {
        this.vibrar(30);
        ptr.classList.add("refreshing");
        ptr.style.transform = "translateY(50px)";
        ptr.style.opacity = 1;
        await this.recarregarAbaAtual();
        ptr.classList.remove("refreshing");
        ptr.style.transform = "translateY(-50px)";
        ptr.style.opacity = 0;
      } else {
        ptr.style.transform = "translateY(-50px)";
        ptr.style.opacity = 0;
      }
    });
  },

  async recarregarAbaAtual() {
    if (this.abaAtual === "home") await this.carregarHome();
    else if (this.abaAtual === "cavalos") await this.carregarTabelaCavalos();
    else if (this.abaAtual === "proprietarios") await this.carregarTabelaProprietarios();
    else if (this.abaAtual === "financas") { await this.carregarFinancas(); await this.carregarDespesasRancho(); }
  },

  // ── Listeners ──
  setupListeners() {
    document.getElementById("propTelefone")?.addEventListener("input", (e) => this.mascaraTelefone(e));
    ["custoValor","mensalidadeValor","custoPropValor","ranchoValor","cavaloValorMensalidade"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", (e) => this.mascaraMoeda(e));
    });
    document.getElementById("formProprietario")?.addEventListener("submit", (e) => this.salvarProprietario(e));
    document.getElementById("formCavalo")?.addEventListener("submit", (e) => this.salvarCavalo(e));
    document.getElementById("formMensalidade")?.addEventListener("submit", (e) => this.salvarMensalidade(e));
    document.getElementById("formCusto")?.addEventListener("submit", (e) => this.salvarCusto(e));
    document.getElementById("formCustoProp")?.addEventListener("submit", (e) => this.salvarCustoProp(e));
    document.getElementById("formCustoRancho")?.addEventListener("submit", (e) => this.salvarCustoRancho(e));
    document.getElementById("formConfig")?.addEventListener("submit", (e) => this.salvarConfig(e));
    document.getElementById("logoutButton")?.addEventListener("click", async () => {
      try { await fetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
      if (navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage("CLEAR_API_CACHE");
      localStorage.removeItem("token");
      window.location.href = "login.html";
    });
    document.getElementById("custoCat")?.addEventListener("change", (e) => {
      const descInput = document.getElementById("custoDesc");
      const exige = ["Frete","Medicamento","Outros"];
      if (exige.includes(e.target.value)) {
        descInput.setAttribute("required", "true");
        descInput.placeholder = `Descreva o ${e.target.value} (Obrigatório)`;
        descInput.value = "";
        descInput.focus();
      } else {
        descInput.removeAttribute("required");
        descInput.placeholder = "Opcional (Exames/Ferradura)";
      }
    });
    const inputBusca = document.getElementById("inputBusca");
    const btnLimpar = document.getElementById("btnLimparBusca");
    inputBusca?.addEventListener("input", (e) => {
      btnLimpar?.classList.toggle("visible", e.target.value.length > 0);
      this.filtrarTabela(e.target.value);
    });
    btnLimpar?.addEventListener("click", () => {
      if (inputBusca) inputBusca.value = "";
      btnLimpar.classList.remove("visible");
      this.filtrarTabela("");
      inputBusca?.focus();
    });
    document.getElementById("inputOrdenacao")?.addEventListener("change", () => this.recarregarAbaAtual());
    document.getElementById("linkTodosAlertas")?.addEventListener("click", () => this.mudarAba("rancho"));
  },

  setupPWA() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const btn = document.getElementById("btnInstalarApp");
      if (btn) { btn.classList.remove("d-none"); btn.onclick = () => this.instalarApp(); }
    });
  },

  async instalarApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const c = await this.deferredPrompt.userChoice;
      if (c.outcome === "accepted") document.getElementById("btnInstalarApp")?.classList.add("d-none");
      this.deferredPrompt = null;
    }
  },

  // ── Navegação ──
  mudarAba(aba) {
    this.vibrar(30);
    this.abaAtual = aba;
    const tabs = { home:"tabHome", cavalos:"tabCavalos", proprietarios:"tabProprietarios", financas:"tabFinancas" };
    const navs = { home:"navBtnHome", cavalos:"navBtnCavalos", proprietarios:"navBtnProps", financas:"navBtnFinancas" };
    const side = { home:"sideNavHome", cavalos:"sideNavAnimais", proprietarios:"sideNavClientes", financas:"sideNavFinancas" };

    Object.values(tabs).forEach((id) => { const el = document.getElementById(id); if (el) { el.classList.add("d-none"); el.classList.remove("fade-in-up"); } });
    Object.values(navs).forEach((id) => document.getElementById(id)?.classList.remove("active"));
    Object.values(side).forEach((id) => document.getElementById(id)?.classList.remove("active"));

    const tabEl = document.getElementById(tabs[aba]);
    if (tabEl) { tabEl.classList.remove("d-none"); void tabEl.offsetWidth; tabEl.classList.add("fade-in-up"); }
    document.getElementById(navs[aba])?.classList.add("active");
    document.getElementById(side[aba])?.classList.add("active");

    if (aba === "home") this.carregarHome();
    else if (aba === "cavalos") this.carregarTabelaCavalos();
    else if (aba === "proprietarios") this.carregarTabelaProprietarios();
    else if (aba === "financas") { this.dataFiltroRancho = new Date(); this.atualizarLabelMesRancho(); this.carregarFinancas(); }
    if (window.innerWidth >= 768) window.scrollTo({ top: 0, behavior: "smooth" });
  },

  adicionarItemAtual() {
    this.vibrar();
    if (this.abaAtual === "cavalos") this.abrirModalNovoCavalo();
    else if (this.abaAtual === "proprietarios") this.abrirModalGerenciarProprietarios();
    else if (this.abaAtual === "financas") document.getElementById("ranchoDesc")?.focus();
    else this.abrirModalNovoCavalo();
  },

  filtrarTabela(termo) {
    const sel = { cavalos:"#listaCavalosBody .animal-card", proprietarios:"#listaProprietariosMainBody .animal-card" }[this.abaAtual];
    if (!sel) return;
    document.querySelectorAll(sel).forEach((el) => {
      const wrap = el.closest("div[style]") || el;
      wrap.style.display = el.textContent.toLowerCase().includes(termo.toLowerCase()) ? "" : "none";
    });
  },

  ordenarLista(lista, criterio) {
    return lista.sort((a, b) => {
      if (criterio === "az") return a.nome.localeCompare(b.nome);
      if (criterio === "za") return b.nome.localeCompare(a.nome);
      if (criterio === "maior_valor") return b.totalSort - a.totalSort;
      if (criterio === "menor_valor") return a.totalSort - b.totalSort;
      return 0;
    });
  },

  _tratarShortcuts() {
    const params = new URLSearchParams(window.location.search);
    const acao = params.get("acao");
    if (!acao) return;
    window.history.replaceState({}, "", "/");
    setTimeout(() => {
      if (acao === "novo-animal") this.abrirModalNovoCavalo();
      if (acao === "novo-cliente") this.abrirModalGerenciarProprietarios();
    }, 800);
  },

  atualizarBadge(qtd) {
    if (!navigator.setAppBadge) return;
    if (qtd > 0) navigator.setAppBadge(qtd).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  },

  skeletonRows(n) {
    return Array(n).fill(`<div class="animal-card mb-0" style="margin:0 0 10px!important;"><div style="display:flex;gap:12px;"><div class="skeleton skeleton-avatar"></div><div style="flex:1;"><div class="skeleton skeleton-text medium"></div><div class="skeleton skeleton-text short" style="margin-top:6px;"></div></div></div></div>`).join("");
  },

  // ── Cache client-side (TTL 30s) ──
  _cacheGet(key) {
    const entry = this._cache[key];
    if (!entry || Date.now() - entry.ts > 30000) { delete this._cache[key]; return null; }
    return entry.data;
  },
  _cacheSet(key, data) { this._cache[key] = { data, ts: Date.now() }; },
  _cacheClear(...prefixes) {
    if (!prefixes.length) { this._cache = {}; return; }
    Object.keys(this._cache).forEach((k) => { if (prefixes.some((p) => k.startsWith(p))) delete this._cache[k]; });
  },

  // ── Swipe entre abas (horizontal) ──
  _setupSwipeTabs() {
    const abas = ["home", "cavalos", "proprietarios", "financas"];
    let startX = 0, startY = 0, active = false;
    const main = document.querySelector("main");
    if (!main) return;

    main.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      active = true;
    }, { passive: true });

    main.addEventListener("touchend", (e) => {
      if (!active) return;
      active = false;
      if (document.querySelector(".modal.show")) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.75) return;
      const idx = abas.indexOf(this.abaAtual);
      if (dx < 0 && idx < abas.length - 1) this.mudarAba(abas[idx + 1]);
      else if (dx > 0 && idx > 0) this.mudarAba(abas[idx - 1]);
    }, { passive: true });
  },

  // ── Utilitários ──
  vibrar(ms = 50) { if (navigator.vibrate) navigator.vibrate(ms); },

  exportarCSV(nomeArquivo, cabecalho, linhas) {
    const csvEscape = (v) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const conteudo = [cabecalho, ...linhas]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
    this.mostrarNotificacao("CSV exportado!");
  },

  escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  mascaraTelefone(e) {
    e.target.value = e.target.value.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
  },

  mascaraMoeda(e) {
    let v = e.target.value.replace(/\D/g, "");
    v = (Number(v) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    e.target.value = v;
  },

  limparMoeda(v) {
    if (!v) return 0;
    return parseFloat(v.replace(/[^\d,]/g, "").replace(",", "."));
  },

  setLoading(btn, l, t) {
    if (l) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t}`; }
    else { btn.disabled = false; btn.innerHTML = t; }
  },

  mostrarNotificacao(msg, tipo = "sucesso") {
    const tm = document.getElementById("toastMessage"), te = document.getElementById("liveToast");
    tm.innerHTML = msg;
    te.className = `toast align-items-center border-0 rounded-4 shadow-lg ${tipo === "erro" ? "text-bg-danger" : "text-bg-success"}`;
    if (this.bsToast) this.bsToast.show();
    this.vibrar(tipo === "erro" ? [50, 50, 50] : 100);
  },

  abrirConfirmacao(t, m, cb) {
    document.getElementById("tituloConfirmacao").textContent = t;
    document.getElementById("msgConfirmacao").textContent = m;
    const btn = document.getElementById("btnConfirmarAcao");
    const nb = btn.cloneNode(true);
    btn.parentNode.replaceChild(nb, btn);
    nb.onclick = () => { this.bsModalConfirm.hide(); this.vibrar(); cb(); };
    this.bsModalConfirm.show();
  },
};

document.addEventListener("DOMContentLoaded", () => RanchoApp.init());
