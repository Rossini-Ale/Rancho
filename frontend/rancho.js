const RanchoApp = {
  // ── Estado ──
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
  dataFiltro: new Date(),
  dataFiltroProp: new Date(),
  dataFiltroRancho: new Date(),
  abaAtual: "home",
  proprietarioAtualId: null,
  categoriaFiltroRancho: "",
  chavePixCache: "",

  // ── Init ──
  async init() {
    const ids = [
      "modalProprietario",
      "modalCavalo",
      "modalFinanceiro",
      "modalMensalidade",
      "modalDetalhesProprietario",
      "modalConfirmacao",
      "modalConfig",
    ];
    const [prop, cav, fin, mens, detProp, conf, cfg] = ids.map(
      (id) => new bootstrap.Modal(document.getElementById(id)),
    );
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
    this.setupPWA();
    this.setupListeners();

    // Carrega nome do usuário logado
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
    } catch (e) {
      console.warn("carregarUsuario:", e);
    }
  },

  _aplicarPerfil() {
    const primeiroNome = this.nomeUsuario.split(" ")[0];
    const iniciais = this._gerarIniciais(this.nomeUsuario);
    const nomeRancho = this.nomeRancho || "HF Controll";

    // Navbar mobile — avatar + nome do rancho
    const navAv = document.getElementById("navbarAvatar");
    if (navAv) navAv.textContent = iniciais;
    const brand = document.getElementById("brandName");
    if (brand) brand.textContent = nomeRancho;

    // Sidebar desktop
    const sideNome = document.getElementById("sidebarNomeUsuario");
    if (sideNome) sideNome.textContent = primeiroNome || "Usuário";
    const sideAv = document.getElementById("sidebarAvatar");
    if (sideAv) sideAv.textContent = iniciais;
    const sideRancho = document.getElementById("sidebarRanchoNome");
    if (sideRancho) sideRancho.textContent = nomeRancho;
    const sideBrand = document.getElementById("sidebarBrandName");
    if (sideBrand) sideBrand.textContent = nomeRancho;

    // Topbar desktop
    const topAv = document.getElementById("topbarAvatar");
    if (topAv) topAv.textContent = iniciais;
  },

  _gerarIniciais(nome) {
    if (!nome) return "HF";
    const p = nome.trim().split(" ").filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return p[0].substring(0, 2).toUpperCase();
  },

  // ══════════════════════════════════════════
  // MODAL DE PERFIL
  // ══════════════════════════════════════════
  async abrirModalPerfil() {
    this.vibrar();
    if (!this.bsModalPerfil) {
      this.bsModalPerfil = new bootstrap.Modal(
        document.getElementById("modalPerfil"),
      );
    }
    // Preenche campos com dados atuais
    document.getElementById("perfilNome").value = this.nomeUsuario || "";
    document.getElementById("perfilNomeRancho").value = this.nomeRancho || "";
    document.getElementById("perfilChavePix").value = this.chavePixCache || "";
    document.getElementById("perfilTelefone").value = "";
    // Busca telefone do backend
    try {
      const p = await ApiService.fetchData("/api/gestao/perfil");
      if (p?.telefone)
        document.getElementById("perfilTelefone").value = p.telefone;
    } catch (e) {}

    this.atualizarPreviaPerifil();
    this.bsModalPerfil.show();

    // Listener do form
    const form = document.getElementById("formPerfil");
    const novo = form.cloneNode(true);
    form.parentNode.replaceChild(novo, form);
    document
      .getElementById("formPerfil")
      .addEventListener("submit", (e) => this.salvarPerfil(e));
    // Re-bind inputs da prévia
    document
      .getElementById("perfilNome")
      .addEventListener("input", () => this.atualizarPreviaPerifil());
    document
      .getElementById("perfilNomeRancho")
      .addEventListener("input", () => this.atualizarPreviaPerifil());
    // Máscara telefone
    document
      .getElementById("perfilTelefone")
      .addEventListener("input", (e) => this.mascaraTelefone(e));
  },

  atualizarPreviaPerifil() {
    const nome =
      document.getElementById("perfilNome")?.value.trim() || "Usuário";
    const rancho =
      document.getElementById("perfilNomeRancho")?.value.trim() ||
      "HF Controll";
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
      // Atualiza saudação na home
      this.setDataHoje();
      this.bsModalPerfil.hide();
      this.mostrarNotificacao("Perfil salvo!");
    } catch (e) {
      this.mostrarNotificacao("Erro ao salvar perfil.", "erro");
    } finally {
      this.setLoading(
        btn,
        false,
        '<i class="fa-solid fa-floppy-disk me-2"></i>Salvar perfil',
      );
    }
  },

  // ── Saudação ──
  setSaudacao() {
    const h = new Date().getHours();
    const el = document.getElementById("saudacaoLabel");
    if (!el) return;
    if (h < 12) el.textContent = "Bom dia";
    else if (h < 18) el.textContent = "Boa tarde";
    else el.textContent = "Boa noite";
  },

  // ── Dark Mode ──
  initDarkMode() {
    const aplicarTema = (dark) => {
      document.body[dark ? "setAttribute" : "removeAttribute"](
        "data-theme",
        "dark",
      );
      localStorage.setItem("theme", dark ? "dark" : "light");
      ["btnDarkMode", "btnDarkModeDesktop", "btnDarkModeSidebar"].forEach(
        (id) => {
          const btn = document.getElementById(id);
          if (!btn) return;
          const i = btn.querySelector("i");
          if (i) {
            i.classList.remove("fa-moon", "fa-sun");
            i.classList.add(dark ? "fa-sun" : "fa-moon");
          }
          // Atualiza label do sidebar
          const span = btn.querySelector("span");
          if (span) span.textContent = dark ? "Modo claro" : "Modo escuro";
        },
      );
    };

    // Aplica tema salvo
    if (localStorage.getItem("theme") === "dark") aplicarTema(true);

    // Adiciona listeners após DOM pronto
    const bindBtns = () => {
      ["btnDarkMode", "btnDarkModeDesktop", "btnDarkModeSidebar"].forEach(
        (id) => {
          const btn = document.getElementById(id);
          if (!btn || btn._darkBound) return;
          btn._darkBound = true;
          btn.addEventListener("click", () => {
            this.vibrar();
            const dark = document.body.getAttribute("data-theme") === "dark";
            aplicarTema(!dark);
          });
        },
      );
    };

    // Tenta agora e também depois do DOM carregar completamente
    bindBtns();
    if (document.readyState !== "complete") {
      window.addEventListener("load", bindBtns);
    }
    // Fallback com pequeno delay para garantir sidebar renderizada
    setTimeout(bindBtns, 300);
  },

  // ── Pull to Refresh ──
  setupPullToRefresh() {
    let startY = 0,
      currentY = 0,
      isPulling = false,
      startX = 0;
    const ptr = document.getElementById("ptrIndicator");

    document.addEventListener(
      "touchstart",
      (e) => {
        // Só ativa se estiver no topo E não houver modal aberto E for toque único
        const modalAberto = document.querySelector(".modal.show");
        if (modalAberto) return;
        if (e.touches.length !== 1) return;
        if (window.scrollY > 0) return;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        currentY = startY;
        isPulling = true;
      },
      { passive: true },
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].clientY;
        const dy = currentY - startY;
        const dx = Math.abs(e.touches[0].clientX - startX);

        // Cancela se for swipe horizontal (navegação) ou scroll muito pequeno
        if (dx > 20) {
          isPulling = false;
          return;
        }

        if (dy > 0 && !window.scrollY) {
          if (e.cancelable) e.preventDefault();
          ptr.style.transform = `translateY(${Math.min(dy / 2, 70)}px)`;
          ptr.style.opacity = Math.min(dy / 100, 1);
        } else {
          isPulling = false;
          ptr.style.transform = "translateY(-50px)";
          ptr.style.opacity = 0;
        }
      },
      { passive: false },
    );

    document.addEventListener("touchend", async () => {
      if (!isPulling) return;
      isPulling = false;
      const d = currentY - startY;

      // Threshold mais alto (120px) para não disparar com cliques
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
    else if (this.abaAtual === "proprietarios")
      await this.carregarTabelaProprietarios();
    else if (this.abaAtual === "financas") {
      await this.carregarFinancas();
      await this.carregarDespesasRancho();
    }
  },

  // ── Listeners ──
  setupListeners() {
    document
      .getElementById("propTelefone")
      ?.addEventListener("input", (e) => this.mascaraTelefone(e));
    ["custoValor", "mensalidadeValor", "custoPropValor", "ranchoValor"].forEach(
      (id) => {
        document
          .getElementById(id)
          ?.addEventListener("input", (e) => this.mascaraMoeda(e));
      },
    );
    document
      .getElementById("formProprietario")
      ?.addEventListener("submit", (e) => this.salvarProprietario(e));
    document
      .getElementById("formCavalo")
      ?.addEventListener("submit", (e) => this.salvarCavalo(e));
    document
      .getElementById("formMensalidade")
      ?.addEventListener("submit", (e) => this.salvarMensalidade(e));
    document
      .getElementById("formCusto")
      ?.addEventListener("submit", (e) => this.salvarCusto(e));
    document
      .getElementById("formCustoProp")
      ?.addEventListener("submit", (e) => this.salvarCustoProp(e));
    document
      .getElementById("formCustoRancho")
      ?.addEventListener("submit", (e) => this.salvarCustoRancho(e));
    document
      .getElementById("formConfig")
      ?.addEventListener("submit", (e) => this.salvarConfig(e));
    document
      .getElementById("logoutButton")
      ?.addEventListener("click", async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {}
        localStorage.removeItem("token");
        window.location.href = "login.html";
      });
    document.getElementById("custoCat")?.addEventListener("change", (e) => {
      const descInput = document.getElementById("custoDesc");
      const exige = ["Frete", "Medicamento", "Outros"];
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
    document
      .getElementById("inputOrdenacao")
      ?.addEventListener("change", () => this.recarregarAbaAtual());
    document
      .getElementById("linkTodosAlertas")
      ?.addEventListener("click", () => this.mudarAba("rancho"));
  },

  setupPWA() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const btn = document.getElementById("btnInstalarApp");
      if (btn) {
        btn.classList.remove("d-none");
        btn.onclick = () => this.instalarApp();
      }
    });
  },
  async instalarApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const c = await this.deferredPrompt.userChoice;
      if (c.outcome === "accepted")
        document.getElementById("btnInstalarApp")?.classList.add("d-none");
      this.deferredPrompt = null;
    }
  },

  // ══════════════════════════════════════════
  // HOME DASHBOARD
  // ══════════════════════════════════════════
  async carregarHome() {
    this.setDataHoje();
    await Promise.all([
      this.carregarKPIs(),
      this.carregarAlertas(),
      this.carregarMiniMapa(),
    ]);
  },

  setDataHoje() {
    const agora = new Date();
    const dias = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const h = agora.getHours();
    const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const primeiroNome = this.nomeUsuario ? this.nomeUsuario.split(" ")[0] : "";
    const saudacao = primeiroNome
      ? `${periodo}, ${primeiroNome}!`
      : `${periodo}!`;
    const dataTexto = `${dias[agora.getDay()]}-feira, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;

    const elSaud = document.getElementById("saudacaoLabel");
    if (elSaud) elSaud.textContent = saudacao;
    const elData = document.getElementById("dataHoje");
    if (elData) elData.textContent = dataTexto;

    // Topbar desktop
    const topSaud = document.getElementById("topbarSaudacao");
    if (topSaud) topSaud.textContent = saudacao;
    const topData = document.getElementById("topbarData");
    if (topData)
      topData.textContent = `${dias[agora.getDay()]}, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
  },

  async carregarKPIs() {
    try {
      // Busca KPIs gerais + cobranças em paralelo
      const [d, cob] = await Promise.all([
        ApiService.fetchData("/api/dashboard/kpis"),
        ApiService.fetchData("/api/dashboard/cobrancas"),
      ]);
      if (!d) return;

      // Animais
      const elA = document.getElementById("kpiAnimais");
      const elAT = document.getElementById("kpiAnimaisTrend");
      if (elA) elA.textContent = d.animais.total;
      if (elAT) {
        elAT.className = "kpi-trend neu";
        elAT.textContent =
          d.animais.novos > 0 ? `+${d.animais.novos} este mês` : "Nenhum novo";
      }

      // Receita
      const elR = document.getElementById("kpiReceita");
      const elRT = document.getElementById("kpiReceitaTrend");
      if (elR)
        elR.textContent = d.receita.total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      if (elRT) {
        if (d.receita.pct !== null) {
          elRT.className = `kpi-trend ${d.receita.pct >= 0 ? "up" : "dn"}`;
          elRT.textContent = `${d.receita.pct > 0 ? "+" : ""}${d.receita.pct}% vs mês ant.`;
        } else {
          elRT.className = "kpi-trend neu";
          elRT.textContent = "Primeiro mês";
        }
      }

      // Em atraso (vem de cobrancas)
      const elAt = document.getElementById("kpiAtraso");
      const elAtT = document.getElementById("kpiAtrasoTrend");
      if (elAt && cob)
        elAt.textContent = cob.totalPendente.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      if (elAtT && cob) {
        const qtd = new Set([
          ...(cob.pendentes || []).map((p) => p.proprietario_id),
          ...(cob.custosDiretos || []).map((c) => c.proprietario_id),
        ]).size;
        elAtT.className = `kpi-trend ${qtd > 0 ? "dn" : "up"}`;
        elAtT.textContent =
          qtd > 0 ? `${qtd} cliente${qtd !== 1 ? "s" : ""}` : "Tudo em dia";
      }

      // Despesas
      const elD = document.getElementById("kpiDespesas");
      const elDT = document.getElementById("kpiDespesasTrend");
      if (elD)
        elD.textContent = d.despesas.total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      if (elDT) {
        if (d.despesas.pct !== null) {
          elDT.className = `kpi-trend ${d.despesas.pct <= 0 ? "up" : "dn"}`;
          elDT.textContent = `${d.despesas.pct > 0 ? "+" : ""}${d.despesas.pct}% vs mês ant.`;
        } else {
          elDT.className = "kpi-trend neu";
          elDT.textContent = "Primeiro mês";
        }
      }
    } catch (e) {
      console.error("KPIs:", e);
    }
  },

  async carregarAlertas() {
    const wrap = document.getElementById("listaAlertas");
    if (!wrap) return;
    try {
      const dados = await ApiService.fetchData("/api/dashboard/alertas");
      if (!dados || !dados.length) {
        wrap.innerHTML = `
          <div style="margin:0 14px 8px;background:rgba(61,122,94,0.07);border:0.5px solid rgba(61,122,94,0.2);border-radius:13px;padding:12px 14px;display:flex;align-items:center;gap:10px;">
            <i class="fa-solid fa-circle-check" style="color:var(--verde);font-size:1.1rem;flex-shrink:0;"></i>
            <div>
              <div style="font-size:0.85rem;font-weight:600;color:var(--verde);">Tudo em dia!</div>
              <div style="font-size:0.75rem;color:var(--texto-suave);margin-top:1px;">Nenhuma pendência no momento.</div>
            </div>
          </div>`;
        return;
      }
      wrap.innerHTML = dados
        .slice(0, 5)
        .map((a) => {
          const cores = {
            vencido: "var(--vermelho)",
            pago: "var(--verde)",
            atencao: "var(--dourado)",
          };
          const cor = cores[a.tipo] || "var(--texto-suave)";
          const valF = a.valor
            ? ` · ${parseFloat(a.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
            : "";
          return `
          <div class="alerta-item" style="cursor:default;">
            <div class="alerta-dot ${a.tipo}" style="background:${cor};${a.tipo === "vencido" ? "box-shadow:0 0 5px rgba(229,57,53,0.35);" : ""}"></div>
            <div style="flex:1;min-width:0;">
              <div class="alerta-titulo">${a.titulo}</div>
              <div class="alerta-sub">${a.sub}${valF}</div>
            </div>
            <span class="alerta-tempo">${a.tempo}</span>
          </div>`;
        })
        .join("");
    } catch (e) {
      wrap.innerHTML = `<div style="padding:0 14px;color:var(--texto-suave);font-size:0.82rem;">Erro ao carregar alertas.</div>`;
    }
  },

  async carregarMiniMapa() {
    const gridEl = document.getElementById("miniMapaGrid");
    const labelEl = document.getElementById("miniMapaLabel");
    const pctEl = document.getElementById("miniMapaPct");
    const barraEl = document.getElementById("miniMapaBarra");
    if (!gridEl) return;
    try {
      const dados = await ApiService.fetchData("/api/dashboard/ocupacao");
      if (!dados) return;

      const { totalOcupados, totalSemLocal, taxaOcupacao } = dados.stats;

      if (labelEl)
        labelEl.textContent = `${totalOcupados + totalSemLocal} anim${totalOcupados + totalSemLocal !== 1 ? "ais" : "al"}`;
      if (pctEl) pctEl.textContent = `${taxaOcupacao}%`;
      if (barraEl) barraEl.style.width = `${taxaOcupacao}%`;

      // Coleta todos os animais
      const todos = [];
      dados.grupos.forEach((g) =>
        g.slots.forEach((s) => {
          const a = s.animais[0];
          todos.push({
            nome: a.nome,
            local: s.nome,
            proprietario: a.proprietario || "",
            pend: a.tem_pendente,
            valor: a.total_mes,
            semLocal: false,
          });
        }),
      );
      dados.semLocal?.forEach((a) =>
        todos.push({
          nome: a.nome,
          local: "",
          proprietario: a.proprietario || "",
          pend: false,
          valor: 0,
          semLocal: true,
        }),
      );

      if (!todos.length) {
        gridEl.innerHTML = `<div style="padding:12px 14px;color:var(--texto-suave);font-size:0.8rem;">Nenhum animal cadastrado.</div>`;
        return;
      }

      // Renderiza lista de animais
      gridEl.innerHTML = todos
        .map((a, i) => {
          const avBg = a.semLocal ? "rgba(196,154,74,0.18)" : "#3D7A5E";
          const avClr = a.semLocal ? "#8B5230" : "white";
          const localTxt = a.semLocal ? "Sem local" : a.local;
          const localClr = a.semLocal ? "#C49A4A" : "var(--texto-suave)";
          const valF =
            a.valor > 0
              ? a.valor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
              : null;
          const badgeBg = a.pend
            ? "rgba(168,50,50,0.09)"
            : "rgba(61,122,94,0.09)";
          const badgeClr = a.pend ? "#7B1A1A" : "#1B5E20";
          const badgeTxt =
            a.pend && valF ? valF : a.pend ? "Pendente" : "Em dia";
          const borda =
            i > 0 ? "border-top:0.5px solid var(--bege-borda);" : "";

          return `<div onclick="RanchoApp.mudarAba('cavalos')" style="${borda}display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;">
          <div style="width:32px;height:32px;border-radius:9px;background:${avBg};display:flex;align-items:center;justify-content:center;color:${avClr};font-size:12px;font-weight:600;flex-shrink:0;">
            ${a.nome.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.nome}</div>
            <div style="font-size:0.72rem;color:${localClr};margin-top:1px;">${localTxt}${a.proprietario ? ` · ${a.proprietario}` : ""}</div>
          </div>
          ${!a.semLocal ? `<span style="background:${badgeBg};color:${badgeClr};border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;white-space:nowrap;flex-shrink:0;">${badgeTxt}</span>` : ""}
        </div>`;
        })
        .join("");
    } catch (e) {
      if (gridEl) gridEl.innerHTML = "";
    }
  },

  // ── Navegação ──
  mudarAba(aba) {
    this.vibrar(30);
    this.abaAtual = aba;
    const tabs = {
      home: "tabHome",
      cavalos: "tabCavalos",
      proprietarios: "tabProprietarios",
      financas: "tabFinancas",
    };
    const navs = {
      home: "navBtnHome",
      cavalos: "navBtnCavalos",
      proprietarios: "navBtnProps",
      financas: "navBtnFinancas",
    };
    const side = {
      home: "sideNavHome",
      cavalos: "sideNavAnimais",
      proprietarios: "sideNavClientes",
      financas: "sideNavFinancas",
    };
    Object.values(tabs).forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("d-none");
        el.classList.remove("fade-in-up");
      }
    });
    Object.values(navs).forEach((id) =>
      document.getElementById(id)?.classList.remove("active"),
    );
    Object.values(side).forEach((id) =>
      document.getElementById(id)?.classList.remove("active"),
    );
    const tabEl = document.getElementById(tabs[aba]);
    if (tabEl) {
      tabEl.classList.remove("d-none");
      void tabEl.offsetWidth;
      tabEl.classList.add("fade-in-up");
    }
    document.getElementById(navs[aba])?.classList.add("active");
    document.getElementById(side[aba])?.classList.add("active");
    if (aba === "home") this.carregarHome();
    else if (aba === "cavalos") this.carregarTabelaCavalos();
    else if (aba === "proprietarios") this.carregarTabelaProprietarios();
    else if (aba === "financas") {
      this.dataFiltroRancho = new Date();
      this.atualizarLabelMesRancho();
      this.carregarFinancas();
    }
    // Scroll topo no desktop
    if (window.innerWidth >= 768)
      window.scrollTo({ top: 0, behavior: "smooth" });
  },

  adicionarItemAtual() {
    this.vibrar();
    if (this.abaAtual === "cavalos") this.abrirModalNovoCavalo();
    else if (this.abaAtual === "proprietarios")
      this.abrirModalGerenciarProprietarios();
    else if (this.abaAtual === "financas")
      document.getElementById("ranchoDesc")?.focus();
    else this.abrirModalNovoCavalo();
  },

  filtrarTabela(termo) {
    const sel = {
      cavalos: "#listaCavalosBody .animal-card",
      proprietarios: "#listaProprietariosMainBody .animal-card",
    }[this.abaAtual];
    if (!sel) return;
    document.querySelectorAll(sel).forEach((el) => {
      const wrap = el.closest("div[style]") || el;
      wrap.style.display = el.textContent
        .toLowerCase()
        .includes(termo.toLowerCase())
        ? ""
        : "none";
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

  // ── Rancho ──
  filtrarCategoriaRancho(cat, el) {
    this.vibrar(20);
    this.categoriaFiltroRancho = cat;
    document
      .querySelectorAll("#chipsCategoriaRancho .chip")
      .forEach((c) => c.classList.remove("active"));
    el?.classList.add("active");
    this.carregarDespesasRancho();
  },

  async carregarDespesasRancho() {
    const mes = this.dataFiltroRancho.getMonth() + 1;
    const ano = this.dataFiltroRancho.getFullYear();
    const lista = document.getElementById("listaDespesasCards");
    if (!lista) return;
    lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;

    try {
      const dados = await ApiService.fetchData(
        `/api/gestao/custos/rancho?mes=${mes}&ano=${ano}`,
      );
      this._dadosDespesas = dados?.custos || [];

      // Atualiza labels dos botões de mês
      this.atualizarLabelMesRancho();

      // Chips dinâmicos — categorias únicas dos dados
      this._atualizarChipsDespesas(this._dadosDespesas);

      // Renderiza
      this._renderDespesas();
    } catch (e) {
      lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);">Erro ao carregar.</div>`;
    }
  },

  _atualizarChipsDespesas(custos) {
    const wrap = document.getElementById("chipsCategoriaRancho");
    if (!wrap) return;
    const cats = [
      ...new Set(custos.map((c) => c.categoria).filter(Boolean)),
    ].sort();
    const catAtual = this.categoriaFiltroRancho || "";
    wrap.innerHTML = `<div class="chip ${catAtual === "" ? "active" : ""}" onclick="RanchoApp.filtrarCategoriaRancho('',this)">Todas</div>`;
    cats.forEach((cat) => {
      wrap.innerHTML += `<div class="chip ${catAtual === cat ? "active" : ""}" onclick="RanchoApp.filtrarCategoriaRancho('${cat}',this)">${cat}</div>`;
    });
  },

  _renderDespesas() {
    const lista = document.getElementById("listaDespesasCards");
    if (!lista) return;
    const cores = {
      Alimentação: { bg: "rgba(61,122,94,0.1)", cor: "#1B5E20" },
      Manutenção: { bg: "rgba(196,154,74,0.12)", cor: "#6B3A1F" },
      Funcionários: { bg: "rgba(122,82,160,0.12)", cor: "#4A2080" },
      Energia: { bg: "rgba(61,100,180,0.1)", cor: "#1A3A8A" },
      Combustível: { bg: "rgba(168,100,50,0.1)", cor: "#7A3810" },
    };
    const icones = {
      Alimentação: "fa-wheat-awn",
      Manutenção: "fa-hammer",
      Funcionários: "fa-user-clock",
      Energia: "fa-bolt",
      Combustível: "fa-gas-pump",
    };

    let itens = [...(this._dadosDespesas || [])];
    if (this.categoriaFiltroRancho)
      itens = itens.filter((c) => c.categoria === this.categoriaFiltroRancho);

    // Gráfico
    const grafico = document.getElementById("areaGraficoRancho");
    if (grafico) {
      grafico.style.display = itens.length ? "block" : "none";
      if (itens.length) this.renderGraficoRancho(itens);
    }

    // Total
    const total = itens.reduce((s, c) => s + parseFloat(c.valor), 0);
    const totalEl = document.getElementById("totalRanchoMesDisplay");
    if (totalEl)
      totalEl.textContent = total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

    if (!itens.length) {
      lista.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;">
          <div style="font-size:2.5rem;color:var(--bege-borda);margin-bottom:8px;"><i class="fa-solid fa-clipboard-check"></i></div>
          <p style="color:var(--verde);font-family:'Lora',serif;font-weight:600;margin:0;">Tudo tranquilo!</p>
          <small style="color:var(--texto-suave);">Nenhuma despesa ${this.categoriaFiltroRancho ? "nesta categoria" : "lançada"}.</small>
        </div>`;
      return;
    }

    // Cards
    lista.innerHTML = itens
      .sort((a, b) => parseFloat(b.valor) - parseFloat(a.valor))
      .map((c) => {
        const valF = parseFloat(c.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const cat = c.categoria || "Geral";
        const cor = cores[cat] || {
          bg: "rgba(138,104,64,0.1)",
          cor: "var(--texto-suave)",
        };
        const ico = icones[cat] || "fa-tag";
        const data = new Date(c.data_despesa);
        const dataF = data.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });

        return `
        <div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:11px;box-shadow:var(--sombra);">
          <div style="width:38px;height:38px;border-radius:11px;background:${cor.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fa-solid ${ico}" style="color:${cor.cor};font-size:0.9rem;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--texto-titulo);font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.descricao}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
              <span style="background:${cor.bg};color:${cor.cor};border-radius:6px;padding:1px 7px;font-size:0.68rem;font-weight:600;">${cat}</span>
              <span style="font-size:0.7rem;color:var(--texto-suave);">${dataF}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span style="font-weight:700;color:var(--vermelho);font-size:0.9rem;">${valF}</span>
            <button class="btn-action icon-red" style="width:32px;height:32px;border-radius:9px;" onclick="RanchoApp.excluirCustoRancho(${c.id})">
              <i class="fa-solid fa-trash-can" style="font-size:0.72rem;"></i>
            </button>
          </div>
        </div>`;
      })
      .join("");
  },

  renderGraficoRancho(custos) {
    const ctx = document.getElementById("graficoRancho");
    if (!ctx) return;
    const d = {};
    custos.forEach((c) => {
      const cat = c.categoria || "Outros";
      d[cat] = (d[cat] || 0) + parseFloat(c.valor);
    });
    if (this.chartRancho) this.chartRancho.destroy();
    this.chartRancho = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(d),
        datasets: [
          {
            data: Object.values(d),
            backgroundColor: [
              "#3D1E0A",
              "#8B5230",
              "#C49A4A",
              "#3D7A5E",
              "#7A52A0",
              "#A83232",
            ],
            borderWidth: 1,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 10,
              font: { size: 10, family: "'DM Sans',sans-serif" },
              color: "#8A6840",
            },
          },
        },
        layout: { padding: 8 },
      },
    });
  },

  mudarMesRancho(d) {
    this.vibrar(20);
    this.dataFiltroRancho.setMonth(this.dataFiltroRancho.getMonth() + d);
    this.carregarDespesasRancho();
  },

  atualizarLabelMesRancho() {
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const d = this.dataFiltroRancho;
    const mesAtual = meses[d.getMonth()];
    const ano = d.getFullYear();

    const label = document.getElementById("labelMesAnoRancho");
    if (label) label.textContent = `${mesAtual} ${ano}`;

    const ant = new Date(d);
    ant.setMonth(ant.getMonth() - 1);
    const prox = new Date(d);
    prox.setMonth(prox.getMonth() + 1);

    const lAnt = document.getElementById("labelMesAnterior");
    if (lAnt) lAnt.textContent = meses[ant.getMonth()];
    const lProx = document.getElementById("labelMesProximo");
    if (lProx) lProx.textContent = meses[prox.getMonth()];
  },

  filtrarCategoriaRancho(cat, el) {
    this.vibrar(10);
    this.categoriaFiltroRancho = cat;
    document
      .querySelectorAll("#chipsCategoriaRancho .chip")
      .forEach((c) => c.classList.remove("active"));
    if (el) el.classList.add("active");
    this._renderDespesas();
  },

  async salvarCustoRancho(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, '<i class="fa-solid fa-plus"></i>');
    let cat = document.getElementById("ranchoCat").value.trim();
    if (cat) cat = cat.charAt(0).toUpperCase() + cat.slice(1);
    else cat = "Geral";
    const body = {
      proprietario_id: null,
      cavalo_id: null,
      descricao: document.getElementById("ranchoDesc").value,
      valor: this.limparMoeda(document.getElementById("ranchoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
      categoria: cat,
    };
    try {
      await ApiService.postData("/api/gestao/custos", body);
      this.mostrarNotificacao("Adicionado!");
      document.getElementById("formCustoRancho").reset();
      this.categoriaFiltroRancho = "";
      await this.carregarDespesasRancho();
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, '<i class="fa-solid fa-plus"></i>');
    }
  },

  excluirCustoRancho(id) {
    this.abrirConfirmacao("Excluir", "Apagar despesa?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/custos/${id}`);
        await this.carregarDespesasRancho();
        this.mostrarNotificacao("Apagado!");
      } catch (e) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },
  async carregarTabelaCavalos() {
    const mapa = document.getElementById("mapaOcupacao");
    if (!mapa) return;
    mapa.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;

    try {
      const dados = await ApiService.fetchData("/api/dashboard/ocupacao");
      if (!dados) return;
      this._dadosAnimais = dados; // cache para filtro
      this._renderAnimais();
    } catch (e) {
      mapa.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);">Erro ao carregar.</div>`;
    }
  },

  _renderAnimais() {
    const dados = this._dadosAnimais;
    if (!dados) return;
    const mapa = document.getElementById("mapaOcupacao");
    if (!mapa) return;

    const busca = (document.getElementById("buscaAnimais")?.value || "")
      .toLowerCase()
      .trim();
    const ordem = document.getElementById("ordenarAnimais")?.value || "nome";

    // KPIs
    const el = (id) => document.getElementById(id);
    if (el("ocupTotal"))
      el("ocupTotal").textContent = dados.stats.totalOcupados;
    if (el("ocupSemLocal"))
      el("ocupSemLocal").textContent = dados.stats.totalSemLocal;
    if (el("ocupTaxa"))
      el("ocupTaxa").textContent = `${dados.stats.taxaOcupacao}%`;
    if (el("ocupPctLabel"))
      el("ocupPctLabel").textContent = `${dados.stats.taxaOcupacao}%`;
    if (el("ocupBarra"))
      el("ocupBarra").style.width = `${dados.stats.taxaOcupacao}%`;
    const taxaEl = el("ocupTaxa");
    if (taxaEl)
      taxaEl.style.color =
        dados.stats.taxaOcupacao >= 70
          ? "var(--verde)"
          : dados.stats.taxaOcupacao >= 40
            ? "var(--dourado)"
            : "var(--vermelho)";
    const labelEl = el("ocupLabel");
    if (labelEl)
      labelEl.textContent = `${dados.stats.totalOcupados} ${dados.stats.totalOcupados !== 1 ? "animais" : "animal"} com local${dados.stats.totalSemLocal > 0 ? ` · ${dados.stats.totalSemLocal} sem local` : ""}`;

    // Coleta todos os animais flat para busca/ordenação
    let todosAnimais = [];
    dados.grupos.forEach((g) =>
      g.slots.forEach((s) => {
        if (s.animais?.length)
          todosAnimais.push({
            ...s.animais[0],
            _local: s.nome,
            _grupo: g.local,
          });
      }),
    );
    dados.semLocal?.forEach((a) =>
      todosAnimais.push({ ...a, _local: "", _grupo: "Sem local" }),
    );

    // Filtra por busca
    if (busca) {
      todosAnimais = todosAnimais.filter(
        (a) =>
          a.nome?.toLowerCase().includes(busca) ||
          a.proprietario?.toLowerCase().includes(busca) ||
          a._local?.toLowerCase().includes(busca),
      );
    }

    // Ordena
    todosAnimais.sort((a, b) => {
      if (ordem === "local")
        return (a._local || "zzz").localeCompare(b._local || "zzz");
      if (ordem === "proprietario")
        return (a.proprietario || "zzz").localeCompare(b.proprietario || "zzz");
      return a.nome.localeCompare(b.nome);
    });

    if (!todosAnimais.length) {
      mapa.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);font-size:0.85rem;">Nenhum animal encontrado.</div>`;
      return;
    }

    // Renderiza como lista simples quando há busca/ordem ativa
    if (busca || ordem !== "nome") {
      mapa.innerHTML = `<div style="padding:0 14px 12px;">
        ${todosAnimais
          .map((a) => {
            const ns = a.nome.replace(/'/g, "\\'");
            const ls = (a._local || "").replace(/'/g, "\\'");
            const os = (a.observacoes || "").replace(/'/g, "\\'");
            const pid = a.proprietario_id || "";
            const pend = a.tem_pendente;
            const totalF =
              a.total_mes > 0
                ? a.total_mes.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : null;
            const bordaClr =
              a._local === "" ? "#C49A4A" : pend ? "#E53935" : "#3D7A5E";
            const statusTxt =
              a._local === ""
                ? "Sem local"
                : pend && totalF
                  ? `${totalF} pendente`
                  : pend
                    ? "Pendente"
                    : "Em dia";
            const statusClr =
              a._local === "" ? "#C49A4A" : pend ? "#A83232" : "#3D7A5E";
            const avBg = a._local === "" ? "rgba(196,154,74,0.18)" : "#3D7A5E";
            const avClr = a._local === "" ? "#8B5230" : "white";
            return `<div onclick="RanchoApp.abrirAcoesAnimal(${a.id},'${ns}','${ls}','${pid}','${os}')"
            style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:13px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:7px;position:relative;overflow:hidden;box-shadow:var(--sombra);">
            <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${bordaClr};"></div>
            <div style="width:38px;height:38px;border-radius:11px;background:${avBg};display:flex;align-items:center;justify-content:center;color:${avClr};font-size:14px;font-weight:600;flex-shrink:0;margin-left:4px;">${a.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.7rem;color:#3D7A5E;font-weight:600;margin-bottom:1px;">${a._local || "Sem local"}</div>
              <div style="font-size:0.88rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.nome}</div>
              <div style="font-size:0.75rem;color:var(--texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.proprietario || "Sem proprietário"}</div>
              <div style="font-size:0.72rem;font-weight:600;color:${statusClr};margin-top:2px;">${statusTxt}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size:0.65rem;color:var(--bege-borda);flex-shrink:0;"></i>
          </div>`;
          })
          .join("")}
      </div>`;
      return;
    }

    // Renderiza mapa completo (sem filtro)
    let html = '<div style="padding:0 14px 12px;">';

    // Sem local primeiro — destaque de alerta
    if (dados.semLocal && dados.semLocal.length > 0) {
      html += `
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.7px;color:#C49A4A;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:0.65rem;"></i> Sem local atribuído
        </div>
        ${dados.semLocal.map((a) => this._cardSemLocal(a)).join("")}
        <div style="height:0.5px;background:var(--bege-borda);margin:8px 0 12px;"></div>`;
    }

    // Grupos por tipo (Baias, Piquetes, etc)
    dados.grupos.forEach((grupo) => {
      html += `
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.7px;color:var(--texto-suave);font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
          <span>${grupo.tipo}</span>
          <span style="background:var(--bege-fundo);border:0.5px solid var(--bege-borda);border-radius:6px;padding:1px 8px;font-size:0.65rem;">${grupo.ocupados} ocupado${grupo.ocupados !== 1 ? "s" : ""}</span>
        </div>
        ${grupo.slots.map((slot) => this._cardOcupado(slot)).join("")}
        <div style="height:0.5px;background:var(--bege-borda);margin:4px 0 12px;"></div>`;
    });

    // Empty state
    if (!dados.grupos.length && !dados.semLocal.length) {
      html = `<div style="text-align:center;padding:3rem 1rem;">
        <div style="font-size:3rem;color:var(--bege-borda);margin-bottom:12px;"><i class="fa-solid fa-horse-head"></i></div>
        <p style="color:var(--texto-suave);font-family:'Lora',serif;font-weight:600;margin-bottom:12px;">Nenhum animal cadastrado</p>
        <button class="btn btn-primary rounded-pill px-4" onclick="RanchoApp.abrirModalNovoCavalo()">
          <i class="fa-solid fa-plus me-1"></i> Cadastrar primeiro animal
        </button>
      </div>`;
    } else {
      html += "</div>";
    }

    mapa.innerHTML = html;
  },

  filtrarAnimais() {
    this._renderAnimais();
  },

  filtrarClientes() {
    const busca = (document.getElementById("buscaClientes")?.value || "")
      .toLowerCase()
      .trim();
    document
      .querySelectorAll("#listaProprietariosMainBody > div")
      .forEach((el) => {
        el.style.display = el.textContent.toLowerCase().includes(busca)
          ? ""
          : "none";
      });
  },

  filtrarFinancas() {
    const busca = (document.getElementById("buscaFinancas")?.value || "")
      .toLowerCase()
      .trim();
    const ordem = document.getElementById("ordenarFinancas")?.value || "nome";
    const lista = document.getElementById("listaCobrancas");
    if (!lista || !this._dadosCobrancas) return;

    let itens = [...this._dadosCobrancas];

    // Filtra
    if (busca)
      itens = itens.filter((i) => i.nome?.toLowerCase().includes(busca));

    // Ordena
    itens.sort((a, b) => {
      if (ordem === "valor")
        return (b.total_pendente || 0) - (a.total_pendente || 0);
      if (ordem === "status")
        return (b.tem_pendencia ? 1 : 0) - (a.tem_pendencia ? 1 : 0);
      return a.nome.localeCompare(b.nome);
    });

    this._renderCobrancas(itens, lista);
  },

  _cardOcupado(slot) {
    const animal = slot.animais[0];
    const ns = animal.nome.replace(/'/g, "\\'");
    const ls = slot.nome.replace(/'/g, "\\'");
    const os = (animal.observacoes || "").replace(/'/g, "\\'");
    const pid = animal.proprietario_id || "";
    const inicial = animal.nome.charAt(0).toUpperCase();
    const pend = animal.tem_pendente;
    const totalF =
      animal.total_mes > 0
        ? animal.total_mes.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : null;
    const bordaClr = pend ? "#E53935" : "#3D7A5E";
    const statusTxt =
      pend && totalF ? `${totalF} pendente` : pend ? "Pendente" : "Em dia";
    const statusClr = pend ? "#A83232" : "#3D7A5E";

    return `
      <div onclick="RanchoApp.abrirAcoesAnimal(${animal.id},'${ns}','${ls}','${pid}','${os}')"
        style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:13px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:7px;position:relative;overflow:hidden;box-shadow:var(--sombra);">
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${bordaClr};border-radius:3px 0 0 3px;"></div>
        <div style="width:38px;height:38px;border-radius:11px;background:#3D7A5E;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:600;flex-shrink:0;margin-left:4px;">
          ${inicial}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.7rem;color:#3D7A5E;font-weight:600;margin-bottom:1px;">${slot.nome}</div>
          <div style="font-size:0.88rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.nome}</div>
          <div style="font-size:0.75rem;color:var(--texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.proprietario || "Sem proprietário"}</div>
          <div style="font-size:0.72rem;font-weight:600;color:${statusClr};margin-top:2px;">${statusTxt}</div>
        </div>
        <i class="fa-solid fa-chevron-right" style="font-size:0.65rem;color:var(--bege-borda);flex-shrink:0;"></i>
      </div>`;
  },

  _cardSemLocal(animal) {
    const ns = animal.nome.replace(/'/g, "\\'");
    const os = (animal.observacoes || "").replace(/'/g, "\\'");
    const pid = animal.proprietario_id || "";

    return `
      <div onclick="RanchoApp.abrirAcoesAnimal(${animal.id},'${ns}','','${pid}','${os}')"
        style="background:rgba(196,154,74,0.07);border:0.5px solid rgba(196,154,74,0.35);border-radius:13px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:7px;position:relative;overflow:hidden;box-shadow:var(--sombra);">
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#C49A4A;border-radius:3px 0 0 3px;"></div>
        <div style="width:38px;height:38px;border-radius:11px;background:rgba(196,154,74,0.18);display:flex;align-items:center;justify-content:center;color:#8B5230;font-size:14px;font-weight:600;flex-shrink:0;margin-left:4px;">
          ${animal.nome.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.7rem;color:#C49A4A;font-weight:600;margin-bottom:1px;display:flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:0.65rem;"></i> Sem local atribuído
          </div>
          <div style="font-size:0.88rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.nome}</div>
          <div style="font-size:0.75rem;color:var(--texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.proprietario || "Sem proprietário"}</div>
        </div>
        <i class="fa-solid fa-chevron-right" style="font-size:0.65rem;color:var(--bege-borda);flex-shrink:0;"></i>
      </div>`;
  },

  // ── Modal de Ações Rápidas do Animal ──
  abrirAcoesAnimal(id, nome, lugar, propId, obs) {
    this.vibrar();
    // Preenche o modal de ações
    const modal = document.getElementById("modalAcoesAnimal");
    if (!modal) return;
    document.getElementById("acoesAnimalNome").textContent = nome;
    document.getElementById("acoesAnimalLocal").textContent =
      lugar || "Sem local";

    // Configura os botões
    document.getElementById("btnAcaoEditar").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      this.abrirModalEditar(id, nome, lugar, propId, obs);
    };
    document.getElementById("btnAcaoCusto").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      setTimeout(() => this.abrirFinanceiro(id, nome), 350);
    };
    document.getElementById("btnAcaoMensalidade").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      setTimeout(() => this.abrirMensalidade(id, nome), 350);
    };
    document.getElementById("btnAcaoFichaVet").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      setTimeout(() => this.abrirFichaVet(id, nome), 350);
    };
    document.getElementById("btnAcaoExcluir").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      setTimeout(() => {
        // Simula o modal de edição aberto para usar excluirCavaloAtual
        document.getElementById("cavaloId").value = id;
        this.excluirCavaloAtual();
      }, 350);
    };

    if (!this.bsModalAcoesAnimal) {
      this.bsModalAcoesAnimal = new bootstrap.Modal(modal);
    }
    this.bsModalAcoesAnimal.show();
  },

  skeletonRows(n) {
    return Array(n)
      .fill(
        `<div class="animal-card mb-0" style="margin:0 0 10px!important;"><div style="display:flex;gap:12px;"><div class="skeleton skeleton-avatar"></div><div style="flex:1;"><div class="skeleton skeleton-text medium"></div><div class="skeleton skeleton-text short" style="margin-top:6px;"></div></div></div></div>`,
      )
      .join("");
  },

  // ── Cards Clientes ──
  async carregarTabelaProprietarios() {
    const wrap = document.getElementById("listaProprietariosMainBody");
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:0 14px;">${this.skeletonRows(3)}</div>`;
    try {
      const props = await ApiService.fetchData("/api/gestao/proprietarios");
      wrap.innerHTML = "";
      if (!props || !props.length) {
        wrap.innerHTML = `
          <div style="text-align:center;padding:3rem 1rem;">
            <div style="font-size:3rem;color:var(--bege-borda);margin-bottom:12px;"><i class="fa-solid fa-users"></i></div>
            <p style="color:var(--texto-suave);font-family:'Lora',serif;font-weight:600;margin-bottom:12px;">Nenhum cliente</p>
            <button class="btn btn-primary rounded-pill px-4" onclick="RanchoApp.abrirModalGerenciarProprietarios()">
              <i class="fa-solid fa-plus me-1"></i> Novo Cliente
            </button>
          </div>`;
        return;
      }

      const lista = props.map((p) => ({
        ...p,
        temPendencia: parseFloat(p.total_divida || 0) > 0,
        txtAnimais:
          p.total_animais == 1 ? "1 animal" : `${p.total_animais || 0} animais`,
        txtValor:
          parseFloat(p.total_divida || 0) > 0
            ? parseFloat(p.total_divida).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "Pago",
      }));

      // Ordena: pendentes primeiro, depois A-Z
      lista.sort((a, b) => {
        if (a.temPendencia !== b.temPendencia) return b.temPendencia ? 1 : -1;
        return a.nome.localeCompare(b.nome);
      });

      lista.forEach((p) => {
        // Avatar colorido por status
        const avBg = p.temPendencia
          ? "linear-gradient(135deg,#7B1A1A,#A83232)"
          : "linear-gradient(135deg,#1B5E20,#3D7A5E)";
        const badgeBg = p.temPendencia
          ? "rgba(168,50,50,0.09)"
          : "rgba(61,122,94,0.09)";
        const badgeClr = p.temPendencia ? "#7B1A1A" : "#1B5E20";
        const nomeS = p.nome.replace(/'/g, "\'");
        const telS = (p.telefone || "").replace(/'/g, "\'");

        const el = document.createElement("div");
        el.className = "animal-card";
        el.style.padding = "0";
        el.style.overflow = "hidden";
        el.innerHTML = `
          <!-- Topo do card -->
          <div style="display:flex;align-items:center;gap:10px;padding:13px 14px 11px;cursor:pointer;"
            onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${nomeS}','${telS}')">
            <div style="width:42px;height:42px;border-radius:13px;background:${avBg};display:flex;align-items:center;justify-content:center;color:white;font-size:1rem;font-weight:600;flex-shrink:0;">
              ${p.nome.charAt(0).toUpperCase()}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Lora',serif;font-size:0.95rem;font-weight:600;color:var(--texto-titulo);">${p.nome}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:0.72rem;color:var(--marrom-claro);font-weight:600;">
                  <i class="fa-solid fa-horse-head" style="font-size:0.62rem;"></i> ${p.txtAnimais}
                </span>
                ${p.telefone ? `<span style="font-size:0.7rem;color:var(--texto-suave);"><i class="fa-solid fa-phone" style="font-size:0.62rem;"></i> ${p.telefone}</span>` : ""}
              </div>
            </div>
            <span style="background:${badgeBg};color:${badgeClr};border-radius:9px;padding:4px 10px;font-size:0.78rem;font-weight:700;white-space:nowrap;flex-shrink:0;">
              ${p.txtValor}
            </span>
          </div>

          <!-- Barra de ações -->
          <div style="display:flex;border-top:0.5px solid var(--bege-borda);">
            <button onclick="RanchoApp.proprietarioAtualId=${p.id};RanchoApp.abrirModalLoteMensalidade()"
              style="flex:1;padding:9px 4px;font-size:0.75rem;font-weight:600;color:var(--marrom-escuro);background:none;border:none;border-right:0.5px solid var(--bege-borda);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background 0.15s;"
              onmouseover="this.style.background='var(--bege-hover)'" onmouseout="this.style.background='none'">
              <i class="fa-solid fa-calendar-check" style="font-size:0.78rem;color:var(--marrom-claro);"></i> Lote
            </button>
            <button onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${nomeS}','${telS}')"
              style="flex:1;padding:9px 4px;font-size:0.75rem;font-weight:600;color:var(--marrom-escuro);background:none;border:none;border-right:0.5px solid var(--bege-borda);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background 0.15s;"
              onmouseover="this.style.background='var(--bege-hover)'" onmouseout="this.style.background='none'">
              <i class="fa-solid fa-file-invoice-dollar" style="font-size:0.78rem;color:var(--marrom-claro);"></i> Fatura
            </button>
            ${
              p.telefone
                ? `
            <button onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${nomeS}','${telS}')"
              style="flex:1;padding:9px 4px;font-size:0.75rem;font-weight:600;color:#1a8a3a;background:none;border:none;border-right:0.5px solid var(--bege-borda);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background 0.15s;"
              onmouseover="this.style.background='rgba(37,211,102,0.05)'" onmouseout="this.style.background='none'">
              <i class="fa-brands fa-whatsapp" style="font-size:0.85rem;"></i> WhatsApp
            </button>`
                : ""
            }
            <button onclick="RanchoApp.abrirModalGerenciarProprietarios(${p.id},'${nomeS}','${telS}')"
              style="flex:0 0 44px;padding:9px 4px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--texto-suave);transition:background 0.15s;"
              onmouseover="this.style.background='var(--bege-hover)'" onmouseout="this.style.background='none'">
              <i class="fa-solid fa-pen" style="font-size:0.75rem;"></i>
            </button>
          </div>`;

        wrap.appendChild(el);
      });
    } catch (e) {
      console.error("carregarTabelaProprietarios:", e);
    }
  },

  // ── Financeiro ──
  async abrirFinanceiro(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("finCavaloId").value = cavaloId;
    document.getElementById("tituloModalFin").textContent =
      `Custos: ${nomeCavalo}`;
    document.getElementById("formCusto").reset();
    document.getElementById("custoIdEdit").value = "";
    document.getElementById("btnSalvarCusto").innerHTML =
      '<i class="fa-solid fa-plus"></i>';
    document
      .getElementById("btnSalvarCusto")
      .classList.replace("btn-warning", "btn-success");
    const desc = document.getElementById("custoDesc");
    desc.removeAttribute("required");
    desc.placeholder = "Descrição";
    this.dataFiltro = new Date();
    this.atualizarLabelMes();
    this.bsModalFin.show();
    this.carregarListaCustos(cavaloId);
  },

  prepararEdicaoCusto(id, desc, cat, valor) {
    this.vibrar();
    document.getElementById("custoIdEdit").value = id;
    document.getElementById("custoDesc").value = desc;
    const sel = document.getElementById("custoCat");
    sel.value = cat;
    sel.dispatchEvent(new Event("change"));
    document.getElementById("custoValor").value = parseFloat(
      valor,
    ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const btn = document.getElementById("btnSalvarCusto");
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    btn.classList.replace("btn-success", "btn-warning");
    document.getElementById("custoDesc").focus();
  },

  async salvarCusto(e) {
    e.preventDefault();
    const btn = e.submitter;
    const custoId = document.getElementById("custoIdEdit").value;
    const isEdit = !!custoId;
    this.setLoading(
      btn,
      true,
      isEdit
        ? '<i class="fa-solid fa-rotate"></i>'
        : '<i class="fa-solid fa-plus"></i>',
    );
    const cavaloId = document.getElementById("finCavaloId").value;
    const cat = document.getElementById("custoCat").value;
    let descricao = document.getElementById("custoDesc").value;
    if (!descricao?.trim()) descricao = cat;
    const body = {
      cavalo_id: cavaloId,
      proprietario_id: null,
      descricao,
      categoria: cat,
      valor: this.limparMoeda(document.getElementById("custoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
    };
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const cav = cavalos.find((c) => c.id == cavaloId);
      if (cav) body.proprietario_id = cav.proprietario_id;
      if (isEdit) {
        await ApiService.putData(`/api/gestao/custos/${custoId}`, body);
        this.mostrarNotificacao("Atualizado!");
      } else {
        await ApiService.postData("/api/gestao/custos", body);
        this.mostrarNotificacao("Adicionado!");
      }
      document.getElementById("formCusto").reset();
      document.getElementById("custoIdEdit").value = "";
      document
        .getElementById("btnSalvarCusto")
        .classList.replace("btn-warning", "btn-success");
      document.getElementById("btnSalvarCusto").innerHTML =
        '<i class="fa-solid fa-plus"></i>';
      this.carregarListaCustos(cavaloId);
      this.carregarTabelaCavalos();
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(
        btn,
        false,
        document.getElementById("custoIdEdit").value
          ? '<i class="fa-solid fa-rotate"></i>'
          : '<i class="fa-solid fa-plus"></i>',
      );
    }
  },

  async carregarListaCustos(cavaloId) {
    const mes = this.dataFiltro.getMonth() + 1,
      ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(
      `/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`,
    );
    const tbody = document.getElementById("tabelaCustosBody");
    tbody.innerHTML = "";
    this.renderGraficoFin(dados?.custos || []);
    if (dados?.custos?.length) {
      dados.custos.forEach((c) => {
        const dia = new Date(c.data_despesa).getDate();
        const mesNome = new Date(c.data_despesa)
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", "")
          .toUpperCase();
        const valF = parseFloat(c.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        let acoes = c.is_mensalidade
          ? c.pago
            ? '<span class="badge-status badge-pago"><i class="fa-solid fa-check"></i></span>'
            : '<span class="badge-status badge-pendente"><i class="fa-solid fa-clock"></i></span>'
          : `<button class="btn-action icon-brown me-1" style="width:30px;height:30px;" onclick="RanchoApp.prepararEdicaoCusto(${c.id},'${c.descricao.replace(/'/g, "\\'")}','${c.categoria}',${c.valor})"><i class="fa-solid fa-pen" style="font-size:0.75rem;"></i></button><button class="btn-action icon-red" style="width:30px;height:30px;" onclick="RanchoApp.excluirCusto(${c.id},${cavaloId})"><i class="fa-solid fa-trash" style="font-size:0.75rem;"></i></button>`;
        tbody.innerHTML += `
          <tr style="border-bottom:0.5px solid var(--bege-borda);">
            <td style="padding:10px 0;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="text-align:center;min-width:40px;background:var(--bege-fundo);border:0.5px solid var(--bege-borda);border-radius:10px;padding:4px;">
                  <div style="font-weight:700;font-size:1rem;font-family:'Lora',serif;line-height:1;">${dia}</div>
                  <div style="font-size:0.6rem;color:var(--texto-suave);">${mesNome}</div>
                </div>
                <div><div style="font-weight:600;color:var(--texto-titulo);font-size:0.85rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.descricao}</div><div style="font-size:0.72rem;color:var(--texto-suave);">${c.categoria}</div></div>
              </div>
            </td>
            <td style="padding:10px 0;text-align:right;">
              <div style="font-weight:700;color:var(--vermelho);font-size:0.85rem;margin-bottom:4px;">${valF}</div>
              <div style="display:flex;justify-content:flex-end;">${acoes}</div>
            </td>
          </tr>`;
      });
      document.getElementById("totalGastoModal").textContent = parseFloat(
        dados.total_gasto,
      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } else {
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted py-5">Nenhum custo neste mês.</td></tr>';
      document.getElementById("totalGastoModal").textContent = "R$ 0,00";
    }
  },

  excluirCusto(id, cavaloId) {
    this.abrirConfirmacao("Excluir", "Apagar custo?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/custos/${id}`);
        this.carregarListaCustos(cavaloId);
        this.carregarTabelaCavalos();
        this.mostrarNotificacao("Apagado!");
      } catch (err) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },
  mudarMes(d) {
    this.vibrar(20);
    this.dataFiltro.setMonth(this.dataFiltro.getMonth() + d);
    this.atualizarLabelMes();
    this.carregarListaCustos(document.getElementById("finCavaloId").value);
  },
  atualizarLabelMes() {
    const el = document.getElementById("labelMesAno");
    if (el)
      el.textContent = this.dataFiltro
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .toUpperCase();
  },

  renderGraficoFin(custos) {
    const ctx = document.getElementById("graficoFinanceiro"),
      area = document.getElementById("areaGrafico");
    if (!custos?.length) {
      if (area) area.style.display = "none";
      return;
    }
    if (area) area.style.display = "block";
    const d = {};
    custos.forEach((c) => {
      const cat = c.categoria || "Outros";
      d[cat] = (d[cat] || 0) + parseFloat(c.valor);
    });
    if (this.chartFinanceiro) this.chartFinanceiro.destroy();
    this.chartFinanceiro = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(d),
        datasets: [
          {
            data: Object.values(d),
            backgroundColor: [
              "#3D1E0A",
              "#8B5230",
              "#C49A4A",
              "#3D7A5E",
              "#7A52A0",
              "#A83232",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { boxWidth: 10, font: { size: 10 }, color: "#8A6840" },
          },
        },
      },
    });
  },

  // ── Modais Animais/Proprietários ──
  abrirModalNovoCavalo(lugarPreenchido = "") {
    this.vibrar();
    document.getElementById("formCavalo").reset();
    document.getElementById("cavaloId").value = "";
    document.getElementById("tituloModalCavalo").textContent = "Novo Animal";
    if (lugarPreenchido)
      document.getElementById("cavaloLugar").value = lugarPreenchido;
    this.carregarSugestoesLocais();
    this.bsModalCavalo.show();
  },
  abrirModalEditar(id, n, l, p, o) {
    this.vibrar();
    document.getElementById("cavaloId").value = id;
    document.getElementById("cavaloNome").value = n;
    document.getElementById("cavaloLugar").value = l;
    document.getElementById("cavaloProprietario").value = p;
    document.getElementById("cavaloObs").value = o;
    document.getElementById("tituloModalCavalo").textContent = "Editar Animal";
    this.bsModalCavalo.show();
  },
  abrirModalGerenciarProprietarios(id = null, n = "", t = "") {
    this.vibrar();
    document.getElementById("formProprietario").reset();
    if (id) {
      document.getElementById("propId").value = id;
      document.getElementById("propNome").value = n;
      document.getElementById("propTelefone").value = t;
      document.getElementById("btnExcluirProp").classList.remove("d-none");
    } else {
      document.getElementById("propId").value = "";
      document.getElementById("btnExcluirProp").classList.add("d-none");
    }
    this.bsModalProp.show();
  },

  async carregarProprietariosSelect() {
    try {
      const p = await ApiService.fetchData("/api/gestao/proprietarios");
      const s = document.getElementById("cavaloProprietario");
      s.innerHTML = '<option value="">Selecione...</option>';
      if (p)
        p.forEach(
          (x) => (s.innerHTML += `<option value="${x.id}">${x.nome}</option>`),
        );
    } catch (e) {}
  },

  async salvarCavalo(e) {
    e.preventDefault();
    const b = e.submitter;
    this.setLoading(b, true, "Salvar");
    const id = document.getElementById("cavaloId").value;
    const lugar = document.getElementById("cavaloLugar").value?.trim() || null;
    const body = {
      nome: document.getElementById("cavaloNome").value,
      lugar,
      proprietario_id: document.getElementById("cavaloProprietario").value,
      observacoes: document.getElementById("cavaloObs").value,
    };
    try {
      if (id) await ApiService.putData(`/api/gestao/cavalos/${id}`, body);
      else await ApiService.postData("/api/gestao/cavalos", body);
      this.bsModalCavalo.hide();
      await this.carregarTabelaCavalos();
      if (this.abaAtual === "home") this.carregarHome();
      this.mostrarNotificacao("Salvo!");
    } catch (err) {
      const msg = err?.message || "";
      // Mostra erro de local ocupado em destaque no próprio campo
      if (msg.toLowerCase().includes("ocupado")) {
        const campoLugar = document.getElementById("cavaloLugar");
        if (campoLugar) {
          campoLugar.style.borderColor = "var(--vermelho)";
          campoLugar.style.boxShadow = "0 0 0 3px rgba(168,50,50,0.15)";
          setTimeout(() => {
            campoLugar.style.borderColor = "";
            campoLugar.style.boxShadow = "";
          }, 3000);
        }
        this.mostrarNotificacao(msg, "erro");
      } else {
        this.mostrarNotificacao("Erro ao salvar.", "erro");
      }
    } finally {
      this.setLoading(b, false, "Salvar");
    }
  },
  excluirCavaloAtual() {
    const id = document.getElementById("cavaloId").value;
    if (id)
      this.abrirConfirmacao("Excluir", "Apagar animal?", async () => {
        await ApiService.deleteData(`/api/gestao/cavalos/${id}`);
        this.bsModalCavalo.hide();
        this.carregarTabelaCavalos();
      });
  },

  async salvarProprietario(e) {
    e.preventDefault();
    const b = e.submitter;
    this.setLoading(b, true, "Salvar");
    const id = document.getElementById("propId").value;
    const body = {
      nome: document.getElementById("propNome").value,
      telefone: document.getElementById("propTelefone").value,
    };
    try {
      if (id) await ApiService.putData(`/api/gestao/proprietarios/${id}`, body);
      else await ApiService.postData("/api/gestao/proprietarios", body);
      this.bsModalProp.hide();
      this.carregarTabelaProprietarios();
      this.carregarProprietariosSelect();
      this.mostrarNotificacao("Salvo!");
    } catch (e) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(b, false, "Salvar");
    }
  },
  excluirProprietarioAtual() {
    const id = document.getElementById("propId").value;
    if (id)
      this.abrirConfirmacao("Excluir", "Apagar cliente?", async () => {
        await ApiService.deleteData(`/api/gestao/proprietarios/${id}`);
        this.bsModalProp.hide();
        this.carregarTabelaProprietarios();
        this.carregarProprietariosSelect();
      });
  },

  // ── Mensalidades ──
  async abrirMensalidade(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("mensalidadeCavaloId").value = cavaloId;
    document.getElementById("tituloModalMensalidade").textContent =
      `Mensalidade: ${nomeCavalo}`;
    document.getElementById("formMensalidade").reset();
    document.getElementById("checkBaia").checked = true;
    document.getElementById("checkAlimentacao").checked = true;
    document.getElementById("checkPiquete").checked = false;
    document.getElementById("checkTreino").checked = false;
    const campoData = document.getElementById("mensalidadeData");
    if (campoData) {
      campoData.closest(".col-6")?.style &&
        (campoData.closest(".col-6").style.display = "none");
      campoData.removeAttribute("required");
      campoData.value = new Date().toISOString().split("T")[0];
    }
    document.getElementById("mensalidadeMes").value = new Date().getMonth() + 1;
    document.getElementById("mensalidadeAno").value = new Date().getFullYear();
    this.bsModalMensalidade.show();
    this.carregarMensalidades(cavaloId);
  },

  async salvarMensalidade(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, "Salvando...");
    const itens = [
      "checkBaia",
      "checkPiquete",
      "checkTreino",
      "checkAlimentacao",
    ]
      .filter((id) => document.getElementById(id)?.checked)
      .map((id) =>
        document.getElementById(id).nextElementSibling.textContent.trim(),
      );
    const body = {
      cavalo_id: document.getElementById("mensalidadeCavaloId").value,
      mes: document.getElementById("mensalidadeMes").value,
      ano: document.getElementById("mensalidadeAno").value,
      valor: this.limparMoeda(
        document.getElementById("mensalidadeValor").value,
      ),
      itens: itens.join(", "),
    };
    try {
      await ApiService.postData("/api/gestao/mensalidades", body);
      this.mostrarNotificacao("Mensalidade adicionada!");
      this.carregarMensalidades(body.cavalo_id);
    } catch (err) {
      if (err.message?.includes("409"))
        this.mostrarNotificacao("Já existe mensalidade neste mês.", "erro");
      else this.mostrarNotificacao("Erro ao salvar", "erro");
    } finally {
      this.setLoading(
        btn,
        false,
        '<i class="fa-solid fa-plus me-2"></i> Adicionar à Fatura',
      );
    }
  },

  async carregarMensalidades(cavaloId) {
    const lista = await ApiService.fetchData(
      `/api/gestao/mensalidades/${cavaloId}`,
    );
    const tbody = document.getElementById("tabelaMensalidadeBody");
    tbody.innerHTML = "";
    const meses = [
      "",
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    if (lista?.length)
      lista.forEach((m) => {
        const valF = parseFloat(m.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const badge = m.pago
          ? '<span class="badge-status badge-pago"><i class="fa-solid fa-check"></i> Pago</span>'
          : '<span class="badge-status badge-pendente"><i class="fa-solid fa-clock"></i> Pendente</span>';
        tbody.innerHTML += `<tr style="border-bottom:0.5px solid var(--bege-borda);"><td style="padding:10px 12px;"><div style="font-family:'Lora',serif;font-weight:600;color:var(--texto-titulo);">${meses[m.mes]} / ${m.ano}</div>${m.itens ? `<div style="font-size:0.72rem;color:var(--texto-suave);margin-top:2px;">${m.itens}</div>` : ""}<div style="margin-top:5px;">${badge}</div></td><td style="padding:10px 12px;text-align:right;"><div style="font-weight:600;color:var(--texto-suave);margin-bottom:5px;">${valF}</div><button class="btn-action icon-red" style="width:30px;height:30px;" onclick="RanchoApp.excluirMensalidade(${m.id},${cavaloId})"><i class="fa-solid fa-trash" style="font-size:0.72rem;"></i></button></td></tr>`;
      });
    else
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted py-4" style="font-size:0.82rem;">Nenhuma mensalidade lançada.</td></tr>';
  },
  excluirMensalidade(id, cavaloId) {
    this.abrirConfirmacao("Excluir", "Remover cobrança?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/mensalidades/${id}`);
        this.carregarMensalidades(cavaloId);
        this.mostrarNotificacao("Removido.");
      } catch (e) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },

  // ── Fatura Proprietário ──
  async abrirDetalhesProprietario(id, n, t) {
    this.vibrar();
    this.proprietarioAtualId = id;
    document.getElementById("tituloDetalhesProp").textContent = n;
    document.getElementById("subtituloDetalhesProp").textContent =
      t || "Sem telefone";
    document.getElementById("formCustoProp").reset();
    this.dataFiltroProp = new Date();
    this.atualizarLabelMesProp();
    this.bsModalDetalhesProp.show();
    this.carregarFaturaProprietario(id, n, t);
  },
  mudarMesProp(d) {
    this.vibrar();
    this.dataFiltroProp.setMonth(this.dataFiltroProp.getMonth() + d);
    this.atualizarLabelMesProp();
    this.carregarFaturaProprietario(
      this.proprietarioAtualId,
      document.getElementById("tituloDetalhesProp").textContent,
      document.getElementById("subtituloDetalhesProp").textContent,
    );
  },
  atualizarLabelMesProp() {
    const el = document.getElementById("labelMesAnoProp");
    if (el)
      el.textContent = this.dataFiltroProp
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .toUpperCase();
  },

  async salvarCustoProp(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, '<i class="fa-solid fa-plus"></i>');
    const body = {
      proprietario_id: this.proprietarioAtualId,
      cavalo_id: null,
      descricao: document.getElementById("custoPropDesc").value,
      valor: this.limparMoeda(document.getElementById("custoPropValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
      categoria: "Avulso",
    };
    try {
      await ApiService.postData("/api/gestao/custos", body);
      this.mostrarNotificacao("Lançado!");
      document.getElementById("formCustoProp").reset();
      this.carregarFaturaProprietario(
        this.proprietarioAtualId,
        document.getElementById("tituloDetalhesProp").textContent,
        document.getElementById("subtituloDetalhesProp").textContent,
      );
    } catch (e) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, '<i class="fa-solid fa-plus"></i>');
    }
  },
  excluirCustoDireto(id) {
    this.abrirConfirmacao("Excluir", "Apagar?", async () => {
      await ApiService.deleteData(`/api/gestao/custos/${id}`);
      this.carregarFaturaProprietario(
        this.proprietarioAtualId,
        document.getElementById("tituloDetalhesProp").textContent,
        document.getElementById("subtituloDetalhesProp").textContent,
      );
      this.mostrarNotificacao("Apagado!");
    });
  },
  async baixarFaturaMes() {
    this.abrirConfirmacao("Baixar", "Confirmar pagamento?", async () => {
      await ApiService.putData("/api/gestao/custos/baixar-mes", {
        proprietario_id: this.proprietarioAtualId,
        mes: this.dataFiltroProp.getMonth() + 1,
        ano: this.dataFiltroProp.getFullYear(),
      });
      this.carregarFaturaProprietario(
        this.proprietarioAtualId,
        document.getElementById("tituloDetalhesProp").textContent,
        document.getElementById("subtituloDetalhesProp").textContent,
      );
      this.mostrarNotificacao("Baixada!");
    });
  },

  async carregarFaturaProprietario(propId, nomeProp, telefoneProp) {
    const tbody = document.getElementById("listaCavalosPropBody");
    tbody.innerHTML =
      '<tr><td colspan="2" class="text-center p-4"><div class="spinner-border" style="color:var(--marrom-claro);" role="status"></div></td></tr>';
    try {
      const mes = this.dataFiltroProp.getMonth() + 1,
        ano = this.dataFiltroProp.getFullYear();
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meus = allCavalos.filter((c) => c.proprietario_id == propId);
      const pCavalos = meus.map(async (c) => {
        const d = await ApiService.fetchData(
          `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
        );
        return d.custos
          ? d.custos.map((i) => ({
              tipo: "cavalo",
              nome: `${c.nome} — ${i.descricao}`,
              custo: parseFloat(i.valor),
              id: i.id,
              pago: i.pago,
            }))
          : [];
      });
      const diretos = await ApiService.fetchData(
        `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
      );
      const iDiretos = diretos.map((c) => ({
        tipo: "direto",
        nome: c.descricao,
        custo: parseFloat(c.valor),
        id: c.id,
        pago: c.pago,
      }));
      const res = await Promise.all(pCavalos);
      const lista = [...res.flat(), ...iDiretos];
      if (!lista.length) {
        tbody.innerHTML =
          '<tr><td colspan="2" class="text-center text-muted py-5" style="font-size:0.82rem;"><i class="fa-regular fa-folder-open" style="font-size:2rem;display:block;margin-bottom:8px;color:var(--bege-borda);"></i>Fatura zerada.</td></tr>';
        document.getElementById("totalGeralProp").textContent = "R$ 0,00";
        document.getElementById("acoesFatura").classList.add("d-none");
        return;
      }
      document.getElementById("acoesFatura").classList.remove("d-none");
      let pendente = 0,
        html = "";
      lista.forEach((item) => {
        const valF = item.custo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        let acao = "";
        const ico = item.pago
          ? '<i class="fa-solid fa-check-circle text-success me-2"></i>'
          : '<i class="fa-regular fa-circle text-muted me-2"></i>';
        if (!item.pago) {
          pendente += item.custo;
          if (item.tipo === "direto")
            acao = `<button class="btn btn-sm text-danger ms-2 p-0" onclick="RanchoApp.excluirCustoDireto(${item.id})"><i class="fa-solid fa-times"></i></button>`;
        }
        html += `<tr style="border-bottom:0.5px solid var(--bege-borda);"><td style="padding:10px 14px;"><div class="${item.pago ? "text-success text-decoration-line-through opacity-75" : "fw-bold"}" style="color:${item.pago ? "" : "var(--texto-titulo)"};">${ico}${item.nome}</div></td><td style="padding:10px 14px;text-align:right;"><span class="${item.pago ? "text-success opacity-75" : "fw-bold"}">${valF}</span>${acao}</td></tr>`;
      });
      tbody.innerHTML = html;
      const btnB = document.getElementById("btnBaixarFatura"),
        btnZ = document.getElementById("btnZapCobranca");
      if (pendente > 0) {
        document.getElementById("totalGeralProp").innerHTML =
          `<span style="color:var(--vermelho);">${pendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>`;
        btnB.disabled = false;
        btnB.innerHTML =
          '<i class="fa-solid fa-check-circle me-2"></i> Confirmar Pagamento';
        btnB.className = "btn btn-primary py-3 rounded-4 fw-bold shadow-sm";
        btnB.onclick = () => this.baixarFaturaMes();
      } else {
        document.getElementById("totalGeralProp").innerHTML =
          '<span class="text-success"><i class="fa-solid fa-check-double me-2"></i>Pago</span>';
        btnB.disabled = false;
        btnB.className = "btn btn-outline-danger py-2 rounded-4 fw-bold";
        btnB.innerHTML =
          '<i class="fa-solid fa-rotate-left me-2"></i> Estornar pagamento';
        btnB.onclick = () => this.estornarFaturaMes();
      }
      const novoBtnZ = btnZ.cloneNode(true);
      btnZ.parentNode.replaceChild(novoBtnZ, btnZ);
      novoBtnZ.onclick = () => {
        const tx =
          pendente > 0
            ? pendente.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "QUITADO";
        this.compartilharFaturaZap(
          propId,
          nomeProp,
          tx,
          telefoneProp.replace(/\D/g, ""),
        );
      };
    } catch (err) {
      console.error(err);
    }
  },

  async compartilharFaturaZap(propId, nomeProp, totalTexto, telefone) {
    this.vibrar();
    this.mostrarNotificacao("Gerando card...");
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1;
    const ano = this.dataFiltroProp.getFullYear();
    const nomesMeses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];

    try {
      // Busca dados da fatura
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meus = allCavalos.filter((c) => c.proprietario_id == propId);
      const historico = await ApiService.fetchData(
        `/api/dashboard/historico-cliente/${propId}`,
      );
      const pix = this.chavePixCache?.trim() || "";

      // Monta itens da fatura
      const itens = [];
      for (const c of meus) {
        // Mensalidade
        const resumo = await ApiService.fetchData(
          `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
        );
        if (resumo?.mensalidade) {
          itens.push({
            nome: `${c.nome} — Mensalidade`,
            valor: parseFloat(resumo.mensalidade.valor),
            pago: resumo.mensalidade.pago == 1,
            inicial: c.nome.charAt(0).toUpperCase(),
          });
        }
        // Custos extras
        if (resumo?.custos) {
          resumo.custos
            .filter((x) => !x.is_mensalidade)
            .forEach((x) => {
              itens.push({
                nome: `${c.nome} — ${x.descricao}`,
                valor: parseFloat(x.valor),
                pago: x.pago == 1,
                inicial: c.nome.charAt(0).toUpperCase(),
              });
            });
        }
      }
      // Custos diretos
      const diretos = await ApiService.fetchData(
        `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
      );
      if (diretos)
        diretos.forEach((x) =>
          itens.push({
            nome: x.descricao,
            valor: parseFloat(x.valor),
            pago: x.pago == 1,
            inicial: "•",
          }),
        );

      const totalPendente = itens
        .filter((i) => !i.pago)
        .reduce((s, i) => s + i.valor, 0);
      const totalGeral = itens.reduce((s, i) => s + i.valor, 0);
      const temPendente = totalPendente > 0;

      // Histórico últimos 6 meses
      const hist6 =
        historico?.historico?.filter((h) => h.totalMes > 0).slice(-6) || [];

      // ── Gera o HTML do card ──
      const card = document.createElement("div");
      card.style.cssText =
        "position:fixed;left:-9999px;top:0;width:340px;font-family:'DM Sans',sans-serif;background:#2C1206;border-radius:18px;overflow:hidden;";

      const dataGeracao =
        new Date().toLocaleDateString("pt-BR") +
        " · " +
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      const itenHtml = itens
        .map((i) => {
          const valF = i.valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          const cor = i.pago ? "#5FBF90" : "#E06060";
          const bgAv = i.pago ? "rgba(95,191,144,0.2)" : "rgba(224,96,96,0.15)";
          const badge = i.pago ? "Pago" : "Pendente";
          const bgBadge = i.pago
            ? "rgba(95,191,144,0.12)"
            : "rgba(224,96,96,0.12)";
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
              <div style="width:26px;height:26px;border-radius:50%;background:${bgAv};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:${cor};flex-shrink:0;">${i.inicial}</div>
              <div style="min-width:0;">
                <div style="font-size:11px;color:#E8C97A;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.nome}</div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:8px;">
              <div style="font-size:11px;font-weight:500;color:${cor};">${valF}</div>
              <div style="font-size:8px;padding:1px 6px;border-radius:4px;background:${bgBadge};color:${cor};margin-top:2px;">${badge}</div>
            </div>
          </div>`;
        })
        .join("");

      const histHtml = hist6
        .map((h) => {
          const bg = h.temPendente
            ? "rgba(224,96,96,0.12)"
            : "rgba(95,191,144,0.15)";
          const ico = h.temPendente
            ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="#E06060"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
            : `<svg width="10" height="10" viewBox="0 0 24 24" fill="#5FBF90"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
          const lbl = [
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
          ][h.mes - 1];
          return `
          <div style="text-align:center;">
            <div style="font-size:8px;color:rgba(232,201,122,0.35);margin-bottom:4px;">${lbl}</div>
            <div style="width:100%;height:22px;border-radius:5px;background:${bg};display:flex;align-items:center;justify-content:center;">${ico}</div>
          </div>`;
        })
        .join("");

      card.innerHTML = `
        <div style="background:#3D1E0A;padding:14px 18px 12px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:9px;background:rgba(232,201,122,0.15);display:flex;align-items:center;justify-content:center;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#E8C97A"><path d="M19 5c-1.5 0-2.8.8-3.5 2H12c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-2.5c1.2-.7 2-2 2-3.5C21 6.1 20.1 5 19 5z"/></svg>
            </div>
            <span style="font-size:13px;color:#E8C97A;font-weight:500;">${this.nomeRancho || "HF Controll"}</span>
          </div>
          <span style="font-size:10px;color:rgba(232,201,122,0.45);">Fatura · ${nomesMeses[mes - 1]} ${ano}</span>
        </div>

        <div style="padding:14px 18px 12px;border-bottom:0.5px solid rgba(255,255,255,0.07);">
          <div style="width:38px;height:38px;border-radius:50%;background:rgba(232,201,122,0.12);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:500;color:#E8C97A;margin-bottom:8px;">${nomeProp.charAt(0).toUpperCase()}</div>
          <div style="font-size:1.05rem;color:#E8C97A;font-weight:500;">${nomeProp}</div>
          <div style="font-size:10px;color:rgba(232,201,122,0.45);margin-top:2px;">${meus.length} anim${meus.length !== 1 ? "ais" : "al"} · ${periodo}</div>
          <div style="background:rgba(232,201,122,0.07);border:0.5px solid rgba(232,201,122,0.15);border-radius:12px;padding:11px 13px;margin-top:10px;">
            <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.6px;">Total do mês</div>
            <div style="font-size:1.7rem;color:#E8C97A;margin-top:3px;font-weight:500;">${totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            ${temPendente ? `<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(224,96,96,0.15);border-radius:6px;padding:2px 8px;font-size:9px;color:#E06060;margin-top:5px;">⚠ Pagamento pendente</div>` : `<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(95,191,144,0.12);border-radius:6px;padding:2px 8px;font-size:9px;color:#5FBF90;margin-top:5px;">✓ Quitado</div>`}
          </div>
        </div>

        <div style="padding:12px 18px 4px;">
          <div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Detalhamento</div>
          ${itenHtml || `<div style="font-size:11px;color:rgba(232,201,122,0.3);padding:8px 0;">Nenhum item neste mês.</div>`}
        </div>

        ${
          hist6.length > 0
            ? `
        <div style="padding:12px 18px 4px;">
          <div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Histórico de pontualidade</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">
            ${histHtml}
          </div>
        </div>`
            : ""
        }

        ${
          pix
            ? `
        <div style="background:rgba(232,201,122,0.06);border:0.5px solid rgba(232,201,122,0.12);border-radius:12px;padding:10px 13px;margin:10px 18px;">
          <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Chave PIX</div>
          <div style="font-size:12px;color:#E8C97A;font-weight:500;margin-top:3px;">${pix}</div>
        </div>`
            : ""
        }

        <div style="padding:10px 18px 14px;display:flex;justify-content:space-between;align-items:center;border-top:0.5px solid rgba(255,255,255,0.06);margin-top:10px;">
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">Gerado em ${dataGeracao}</span>
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">${this.nomeRancho || "HF Controll"}</span>
        </div>`;

      document.body.appendChild(card);

      // ── Captura como imagem com html2canvas ──
      if (!window.html2canvas) {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(s);
        await new Promise((r) => (s.onload = r));
      }

      const canvas = await window.html2canvas(card, {
        backgroundColor: "#2C1206",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(card);

      // ── Compartilha via Web Share API ou baixa ──
      canvas.toBlob(async (blob) => {
        const tel = telefone.replace(/\D/g, "");
        const valF =
          totalPendente > 0
            ? totalPendente.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "QUITADO";
        const msg = `Olá *${nomeProp}*! 👋\n\nSegue sua fatura de *${periodo}*:\n💰 Total: *${valF}*${pix ? `\n\n🏦 PIX: *${pix}*` : ""}\n\nQualquer dúvida, estou à disposição!`;

        // Tenta Web Share API (funciona no mobile)
        if (
          navigator.share &&
          navigator.canShare?.({
            files: [new File([blob], "fatura.png", { type: "image/png" })],
          })
        ) {
          try {
            await navigator.share({
              files: [
                new File([blob], `Fatura_${nomeProp}_${periodo}.png`, {
                  type: "image/png",
                }),
              ],
              text: msg,
            });
            return;
          } catch (e) {
            /* fallback */
          }
        }

        // Fallback: baixa a imagem + abre WhatsApp com texto
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Fatura_${nomeProp}_${periodo}.png`;
        link.click();
        URL.revokeObjectURL(url);
        setTimeout(() => {
          window.open(
            `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`,
            "_blank",
          );
        }, 800);
        this.mostrarNotificacao("Imagem salva! Agora anexe no WhatsApp.");
      }, "image/png");
    } catch (e) {
      console.error("compartilharFaturaZap:", e);
      this.mostrarNotificacao("Erro ao gerar card.", "erro");
    }
  },

  // ── PDF ──
  async gerarPDF() {
    if (!window.jspdf) {
      this.mostrarNotificacao("Carregando PDF...", "erro");
      return;
    }
    const { jsPDF } = window.jspdf,
      doc = new jsPDF();
    const cavaloId = document.getElementById("finCavaloId").value;
    const nomeCavalo = document
      .getElementById("tituloModalFin")
      .textContent.replace("Custos: ", "");
    const periodo = document.getElementById("labelMesAno").textContent;
    const mes = this.dataFiltro.getMonth() + 1,
      ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(
      `/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`,
    );
    if (!dados?.custos?.length) {
      this.mostrarNotificacao("Sem custos.", "erro");
      return;
    }
    doc.setTextColor(61, 30, 10);
    doc.setFontSize(18);
    doc.text(document.getElementById("brandName").textContent, 14, 20);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.text(`Extrato de Despesas`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Animal: ${nomeCavalo}`, 14, 35);
    doc.text(`Período: ${periodo}`, 14, 40);
    doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 45);
    const rows = dados.custos.map((c) => [
      new Date(c.data_despesa).toLocaleDateString("pt-BR"),
      c.descricao,
      c.categoria,
      parseFloat(c.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    ]);
    doc.autoTable({
      startY: 50,
      head: [["Data", "Descrição", "Categoria", "Valor"]],
      body: rows,
      theme: "grid",
      headStyles: {
        fillColor: [61, 30, 10],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        3: { halign: "right", fontStyle: "bold" },
      },
    });
    doc.setFontSize(14);
    doc.setTextColor(168, 50, 50);
    doc.text(
      parseFloat(dados.total_gasto).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      195,
      doc.lastAutoTable.finalY + 10,
      { align: "right" },
    );
    doc.save(`${nomeCavalo.trim()}_${periodo.replace(" ", "_")}.pdf`);
  },

  async _gerarDocPDFDados(propId, nomeProp, periodo, mes, ano) {
    if (!window.jspdf) return null;
    const { jsPDF } = window.jspdf,
      doc = new jsPDF();
    doc.setTextColor(61, 30, 10);
    doc.setFontSize(18);
    doc.text(document.getElementById("brandName").textContent, 14, 20);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Fatura / Extrato`, 14, 28);
    doc.text(`Cliente: ${nomeProp}`, 14, 35);
    doc.text(`Período: ${periodo}`, 14, 42);
    let rows = [],
      total = 0;
    const all = await ApiService.fetchData("/api/gestao/cavalos");
    for (const c of all.filter((x) => x.proprietario_id == propId)) {
      const d = await ApiService.fetchData(
        `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
      );
      if (d.custos)
        d.custos.forEach((x) => {
          total += parseFloat(x.valor);
          rows.push([
            new Date(x.data_despesa).toLocaleDateString("pt-BR"),
            `Animal: ${c.nome}`,
            `${x.descricao} ${x.pago ? "(Pago)" : ""}`,
            parseFloat(x.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
          ]);
        });
    }
    const dir = await ApiService.fetchData(
      `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
    );
    if (dir)
      dir.forEach((x) => {
        total += parseFloat(x.valor);
        rows.push([
          new Date(x.data_despesa).toLocaleDateString("pt-BR"),
          "Avulso",
          `${x.descricao} ${x.pago ? "(Pago)" : ""}`,
          parseFloat(x.valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
        ]);
      });
    if (!rows.length) return null;
    doc.autoTable({
      startY: 50,
      head: [["Data", "Ref", "Descrição", "Valor"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [61, 30, 10] },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    });
    doc.setFontSize(14);
    doc.text(
      `TOTAL GERAL: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      195,
      doc.lastAutoTable.finalY + 15,
      { align: "right" },
    );
    return { doc };
  },
  async gerarPDFProprietario() {
    const nome = document.getElementById("tituloDetalhesProp").textContent,
      periodo = document.getElementById("labelMesAnoProp").textContent;
    const res = await this._gerarDocPDFDados(
      this.proprietarioAtualId,
      nome,
      periodo,
      this.dataFiltroProp.getMonth() + 1,
      this.dataFiltroProp.getFullYear(),
    );
    if (res) res.doc.save(`Fatura_${nome.trim()}.pdf`);
    else this.mostrarNotificacao("Sem dados.", "erro");
  },

  // ── Relatório Mensal ──
  gerarRelatorio() {
    const mes =
      parseInt(document.getElementById("relatorioMes")?.value) ||
      new Date().getMonth() + 1;
    const ano =
      parseInt(document.getElementById("relatorioAno")?.value) ||
      new Date().getFullYear();
    Relatorio.gerar(mes, ano);
  },

  async compartilharResumoMes() {
    this.vibrar();
    this.mostrarNotificacao("Gerando resumo...");
    const mes =
      parseInt(document.getElementById("relatorioMes")?.value) ||
      new Date().getMonth() + 1;
    const ano =
      parseInt(document.getElementById("relatorioAno")?.value) ||
      new Date().getFullYear();
    const nomesMeses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const nomeMes = nomesMeses[mes - 1];

    try {
      const [kpis, ocup] = await Promise.all([
        ApiService.fetchData(`/api/dashboard/relatorio?mes=${mes}&ano=${ano}`),
        ApiService.fetchData("/api/dashboard/ocupacao"),
      ]);
      if (!kpis) return;

      const receita = kpis.kpis.receita.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const despesas = kpis.kpis.despesas.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const lucro = kpis.kpis.lucro.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const atraso = kpis.kpis.pendencias.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const pctRec =
        kpis.kpis.receita.pct !== null
          ? `${kpis.kpis.receita.pct > 0 ? "↑" : "↓"} ${Math.abs(kpis.kpis.receita.pct)}% vs mês ant.`
          : "Primeiro mês";
      const pctDesp =
        kpis.kpis.despesas.pct !== null
          ? `${kpis.kpis.despesas.pct > 0 ? "↑" : "↓"} ${Math.abs(kpis.kpis.despesas.pct)}% vs mês ant.`
          : "Primeiro mês";
      const totalAnim = ocup?.stats?.totalAnimais || 0;
      const ocup7 = ocup?.stats?.totalOcupados || 0;

      // Animais grid
      const todos = [];
      ocup?.grupos?.forEach((g) =>
        g.slots.forEach((s) =>
          todos.push({
            nome: s.animais[0].nome,
            pend: s.animais[0].tem_pendente,
          }),
        ),
      );
      ocup?.semLocal?.forEach((a) =>
        todos.push({ nome: a.nome, pend: a.tem_pendente }),
      );

      const animGrid = todos
        .map((a) => {
          const bg = a.pend ? "rgba(224,96,96,0.15)" : "rgba(232,201,122,0.1)";
          const clr = a.pend ? "#E06060" : "#E8C97A";
          return `<div style="width:26px;height:26px;border-radius:7px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:${clr};">${a.nome.charAt(0).toUpperCase()}</div>`;
        })
        .join("");

      const dataGeracao =
        new Date().toLocaleDateString("pt-BR") +
        " às " +
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

      const card = document.createElement("div");
      card.style.cssText =
        "position:fixed;left:-9999px;top:0;width:340px;font-family:'DM Sans',sans-serif;background:#2C1206;border-radius:18px;overflow:hidden;";
      card.innerHTML = `
        <div style="background:#3D1E0A;padding:14px 18px 12px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:9px;background:rgba(232,201,122,0.15);display:flex;align-items:center;justify-content:center;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#E8C97A"><path d="M19 5c-1.5 0-2.8.8-3.5 2H12c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-2.5c1.2-.7 2-2 2-3.5C21 6.1 20.1 5 19 5z"/></svg>
            </div>
            <span style="font-size:13px;color:#E8C97A;font-weight:500;">${this.nomeRancho || "HF Controll"}</span>
          </div>
          <span style="font-size:10px;color:rgba(232,201,122,0.45);">${nomeMes} ${ano}</span>
        </div>

        <div style="padding:16px 18px 12px;border-bottom:0.5px solid rgba(255,255,255,0.07);">
          <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.6px;">Lucro líquido</div>
          <div style="font-size:2.2rem;color:#E8C97A;margin-top:4px;font-weight:500;">${lucro}</div>
          <div style="font-size:10px;color:rgba(232,201,122,0.4);margin-top:3px;">Receita ${receita} · Despesas ${despesas}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,0.07);">
          <div style="background:#2C1206;padding:12px 14px;">
            <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Receita</div>
            <div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${receita}</div>
            <div style="font-size:9px;color:rgba(95,191,144,0.8);margin-top:2px;">${pctRec}</div>
          </div>
          <div style="background:#2C1206;padding:12px 14px;">
            <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Despesas</div>
            <div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${despesas}</div>
            <div style="font-size:9px;color:rgba(224,96,96,0.8);margin-top:2px;">${pctDesp}</div>
          </div>
          <div style="background:#2C1206;padding:12px 14px;">
            <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Em atraso</div>
            <div style="font-size:15px;font-weight:500;color:${kpis.kpis.pendencias.total > 0 ? "#E06060" : "#E8C97A"};margin-top:3px;">${atraso}</div>
            <div style="font-size:9px;color:rgba(232,201,122,0.35);margin-top:2px;">${kpis.kpis.pendencias.clientes} cliente${kpis.kpis.pendencias.clientes !== 1 ? "s" : ""}</div>
          </div>
          <div style="background:#2C1206;padding:12px 14px;">
            <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Animais</div>
            <div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${totalAnim}</div>
            <div style="font-size:9px;color:rgba(232,201,122,0.35);margin-top:2px;">${ocup7} com local</div>
          </div>
        </div>

        ${
          todos.length > 0
            ? `
        <div style="padding:12px 18px 14px;">
          <div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Animais no rancho</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">${animGrid}</div>
        </div>`
            : ""
        }

        <div style="padding:10px 18px 14px;display:flex;justify-content:space-between;align-items:center;border-top:0.5px solid rgba(255,255,255,0.06);">
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">Gerado em ${dataGeracao}</span>
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">${this.nomeRancho || "HF Controll"}</span>
        </div>`;

      document.body.appendChild(card);

      if (!window.html2canvas) {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(s);
        await new Promise((r) => (s.onload = r));
      }

      const canvas = await window.html2canvas(card, {
        backgroundColor: "#2C1206",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      document.body.removeChild(card);

      canvas.toBlob(async (blob) => {
        const file = new File([blob], `Resumo_${nomeMes}_${ano}.png`, {
          type: "image/png",
        });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              text: `Resumo do rancho — ${nomeMes} ${ano} 🐴`,
            });
            return;
          } catch (e) {}
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        this.mostrarNotificacao("Imagem salva!");
      }, "image/png");
    } catch (e) {
      console.error("compartilharResumoMes:", e);
      this.mostrarNotificacao("Erro ao gerar resumo.", "erro");
    }
  },

  // ══════════════════════════════════════════
  // ABA FINANÇAS — COBRANÇAS
  // ══════════════════════════════════════════
  async carregarFinancas() {
    await Promise.all([
      this.carregarCobrancas(),
      this.carregarDespesasRancho(),
    ]);
  },

  async carregarCobrancas() {
    const wrap = document.getElementById("listaCobrancas");
    if (!wrap) return;
    wrap.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;
    try {
      const dados = await ApiService.fetchData("/api/dashboard/cobrancas");
      if (!dados) return;

      // KPIs
      const totalEl = document.getElementById("totalAtraso");
      const qtdEl = document.getElementById("qtdAtrasados");
      const recEl = document.getElementById("receitaMesCobrancas");
      const pctEl = document.getElementById("pctReceitaCobrancas");

      if (totalEl)
        totalEl.textContent = dados.totalPendente.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      if (qtdEl) {
        const qtd = new Set([
          ...dados.pendentes.map((p) => p.proprietario_id),
          ...dados.custosDiretos.map((c) => c.proprietario_id),
        ]).size;
        qtdEl.textContent = `${qtd} cliente${qtd !== 1 ? "s" : ""}`;
        qtdEl.className = `kpi-trend ${qtd > 0 ? "dn" : "up"}`;
      }
      if (recEl)
        recEl.textContent = dados.receitaMes.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      if (pctEl && dados.pctReceita !== null) {
        pctEl.textContent = `${dados.pctReceita > 0 ? "+" : ""}${dados.pctReceita}% vs mês ant.`;
        pctEl.className = `kpi-trend ${dados.pctReceita >= 0 ? "up" : "dn"}`;
      }

      // Cache para filtro
      const todos = [
        ...dados.pendentes.map((p) => ({ ...p, tipo: "mensalidade" })),
        ...dados.custosDiretos.map((c) => ({
          ...c,
          tipo: "direto",
          cavalo: null,
        })),
      ].sort((a, b) => b.dias_atraso - a.dias_atraso);
      this._dadosCobrancas = todos;

      this._renderCobrancas(todos, wrap);
    } catch (e) {
      console.error("carregarCobrancas:", e);
    }
  },

  _renderCobrancas(todos, wrap) {
    if (!wrap) return;
    if (!todos.length) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;">
          <div style="font-size:3rem;color:var(--bege-borda);margin-bottom:12px;"><i class="fa-solid fa-circle-check"></i></div>
          <p style="color:var(--verde);font-family:'Lora',serif;font-weight:600;margin-bottom:4px;">Tudo em dia!</p>
          <small style="color:var(--texto-suave);">Nenhuma cobrança pendente.</small>
        </div>`;
      return;
    }
    wrap.innerHTML = todos
      .map((item) => {
        const diasCor =
          item.dias_atraso > 30
            ? "var(--vermelho)"
            : item.dias_atraso > 7
              ? "var(--dourado)"
              : "var(--texto-suave)";
        const diasBg =
          item.dias_atraso > 30
            ? "rgba(168,50,50,0.09)"
            : item.dias_atraso > 7
              ? "rgba(196,154,74,0.12)"
              : "rgba(138,104,64,0.08)";
        const borderClr =
          item.dias_atraso > 30
            ? "var(--vermelho)"
            : item.dias_atraso > 7
              ? "var(--dourado)"
              : "var(--bege-borda)";
        const valF = item.valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const descricao =
          item.tipo === "mensalidade"
            ? `${item.cavalo} · ${item.itens || "Mensalidade"}`
            : item.descricao;
        const nomesMeses = [
          "",
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ];
        const periodo =
          item.tipo === "mensalidade"
            ? `${nomesMeses[item.mes]}/${item.ano}`
            : new Date(item.data_despesa).toLocaleDateString("pt-BR");

        return `
          <div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-left:3px solid ${borderClr};border-radius:16px;padding:13px 14px;margin-bottom:10px;box-shadow:var(--sombra);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div style="flex:1;min-width:0;">
                <div style="font-family:'Lora',serif;font-size:0.95rem;font-weight:600;color:var(--texto-titulo);">${item.proprietario || "Sem cliente"}</div>
                <div style="font-size:0.75rem;color:var(--texto-suave);margin-top:3px;">${descricao} · ${periodo}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-weight:700;color:var(--vermelho);font-size:0.95rem;">${valF}</div>
                <div style="background:${diasBg};color:${diasCor};border-radius:8px;padding:2px 8px;font-size:0.7rem;font-weight:600;margin-top:3px;">${item.dias_atraso} dias</div>
              </div>
            </div>
            ${
              item.telefone
                ? `
            <button
              onclick="RanchoApp.cobrarWhatsApp('${item.proprietario}','${item.telefone}','${valF}','${descricao}','${periodo}')"
              style="margin-top:10px;background:#25D366;color:white;border:none;border-radius:10px;padding:7px 14px;font-size:0.78rem;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'DM Sans',sans-serif;">
              <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i> Cobrar via WhatsApp
            </button>`
                : ""
            }
          </div>`;
      })
      .join("");
  },

  cobrarWhatsApp(nome, telefone, valor, descricao, periodo) {
    this.vibrar();
    const tel = telefone.replace(/\D/g, "");
    const msg = `Olá *${nome}*! 👋\n\nPassando para lembrar sobre o pagamento pendente:\n\n📋 *${descricao}*\n📅 Período: ${periodo}\n💰 Valor: *${valor}*\n\n${this.chavePixCache ? `Chave PIX para pagamento:\n*${this.chavePixCache}*\n\n` : ""}Qualquer dúvida, estou à disposição!`;
    window.open(
      `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  },

  // ══════════════════════════════════════════
  // HISTÓRICO COMPLETO DO CLIENTE
  // ══════════════════════════════════════════
  async abrirHistoricoCliente(propId, nomeProp) {
    this.vibrar();
    if (!this.bsModalHistoricoCliente) {
      this.bsModalHistoricoCliente = new bootstrap.Modal(
        document.getElementById("modalHistoricoCliente"),
      );
    }
    document.getElementById("tituloHistoricoCliente").textContent = nomeProp;
    document.getElementById("subtituloHistoricoCliente").textContent =
      "Últimos 12 meses";
    document.getElementById("listaHistoricoCliente").innerHTML =
      `<div style="text-align:center;padding:2rem;color:var(--texto-suave);">Carregando...</div>`;
    this.bsModalHistoricoCliente.show();

    try {
      const dados = await ApiService.fetchData(
        `/api/dashboard/historico-cliente/${propId}`,
      );
      if (!dados) return;

      // Stats
      document.getElementById("statEmDia").textContent = dados.stats.mesesEmDia;
      document.getElementById("statAtrasados").textContent =
        dados.stats.mesesAtrasados;
      document.getElementById("statPontualidade").textContent =
        `${dados.stats.taxaPagamento}%`;

      // Lista histórico
      const nomesMeses = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const lista = document.getElementById("listaHistoricoCliente");

      lista.innerHTML =
        dados.historico
          .filter((h) => h.totalMes > 0)
          .reverse()
          .map((h) => {
            const totalF = h.totalMes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const pagoF = h.totalPago.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const cor = h.temPendente ? "var(--vermelho)" : "var(--verde)";
            const bg = h.temPendente
              ? "rgba(168,50,50,0.08)"
              : "rgba(61,122,94,0.08)";
            const icone = h.temPendente ? "fa-clock" : "fa-check-circle";
            const status = h.temPendente ? "Pendente" : "Pago";

            return `
          <div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:16px;padding:12px 14px;margin-bottom:8px;box-shadow:var(--sombra);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-family:'Lora',serif;font-size:0.92rem;font-weight:600;color:var(--texto-titulo);">${nomesMeses[h.mes - 1]} ${h.ano}</div>
                <div style="font-size:0.72rem;color:var(--texto-suave);margin-top:2px;">
                  ${h.mensalidades.map((m) => `${m.cavalo}: ${m.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" · ")}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:var(--texto-titulo);font-size:0.9rem;">${totalF}</div>
                <div style="background:${bg};color:${cor};border-radius:8px;padding:2px 8px;font-size:0.7rem;font-weight:600;margin-top:3px;display:inline-flex;align-items:center;gap:4px;">
                  <i class="fa-solid ${icone}" style="font-size:0.65rem;"></i>${status}
                </div>
              </div>
            </div>
          </div>`;
          })
          .join("") ||
        `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Nenhum registro nos últimos 12 meses.</div>`;
    } catch (e) {
      console.error("abrirHistoricoCliente:", e);
    }
  },

  // ══════════════════════════════════════════
  // BUSCA GLOBAL
  // ══════════════════════════════════════════
  setupBuscaGlobal() {
    const input = document.getElementById("inputBuscaGlobal");
    const btnClr = document.getElementById("btnLimparBuscaGlobal");
    const result = document.getElementById("resultadosBusca");
    if (!input) return;

    let timer;
    input.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      btnClr?.classList.toggle("visible", val.length > 0);
      clearTimeout(timer);
      if (val.length < 2) {
        if (result) result.style.display = "none";
        return;
      }
      timer = setTimeout(() => this.executarBuscaGlobal(val), 350);
    });

    btnClr?.addEventListener("click", () => {
      if (input) input.value = "";
      btnClr.classList.remove("visible");
      if (result) result.style.display = "none";
    });
  },

  async executarBuscaGlobal(termo) {
    const result = document.getElementById("resultadosBusca");
    if (!result) return;
    result.style.display = "block";
    result.innerHTML = `<div style="padding:12px;color:var(--texto-suave);font-size:0.82rem;">Buscando...</div>`;

    try {
      const dados = await ApiService.fetchData(
        `/api/dashboard/busca?q=${encodeURIComponent(termo)}`,
      );
      const total =
        (dados.cavalos?.length || 0) +
        (dados.proprietarios?.length || 0) +
        (dados.custos?.length || 0);

      if (!total) {
        result.innerHTML = `<div style="padding:12px;color:var(--texto-suave);font-size:0.82rem;">Nenhum resultado para "<b>${termo}</b>"</div>`;
        return;
      }

      let html = `<div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:16px;overflow:hidden;margin-bottom:10px;">`;

      if (dados.cavalos?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Animais</div>`;
        html += dados.cavalos
          .map(
            (c) => `
          <div onclick="RanchoApp.abrirModalEditar(${c.id},'${c.nome.replace(/'/g, "\\'")}','${(c.lugar || "").replace(/'/g, "\\'")}','${c.proprietario_id || ""}','')"
            style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;gap:10px;cursor:pointer;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--marrom-claro),var(--marrom-escuro));display:flex;align-items:center;justify-content:center;color:var(--dourado-claro);font-size:12px;font-weight:600;flex-shrink:0;">${c.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${c.nome}</div>
              <div style="font-size:0.72rem;color:var(--texto-suave);">${c.lugar || "Sem local"} · ${c.nome_proprietario || "Sem proprietário"}</div>
            </div>
            ${c.total_mes > 0 ? `<span style="background:rgba(168,50,50,0.08);color:var(--vermelho);border-radius:8px;padding:2px 8px;font-size:0.72rem;font-weight:600;">${c.total_mes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>` : ""}
          </div>`,
          )
          .join("");
      }

      if (dados.proprietarios?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;${dados.cavalos?.length ? "border-top:0.5px solid var(--bege-borda);" : ""}">Clientes</div>`;
        html += dados.proprietarios
          .map(
            (p) => `
          <div onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${p.nome}','${p.telefone || ""}')"
            style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;gap:10px;cursor:pointer;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6B7280,#374151);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;flex-shrink:0;">${p.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
              <div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${p.nome}</div>
              <div style="font-size:0.72rem;color:var(--texto-suave);">${p.telefone || "Sem telefone"}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;color:var(--texto-suave);"></i>
          </div>`,
          )
          .join("");
      }

      if (dados.custos?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;border-top:0.5px solid var(--bege-borda);">Custos recentes</div>`;
        html += dados.custos
          .map((c) => {
            const valF = c.valor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const ref = c.cavalo || c.proprietario || "Rancho";
            return `
            <div style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div style="min-width:0;">
                <div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.descricao}</div>
                <div style="font-size:0.72rem;color:var(--texto-suave);">${ref} · ${new Date(c.data_despesa).toLocaleDateString("pt-BR")}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:0.85rem;font-weight:600;color:var(--vermelho);">${valF}</div>
                <div style="font-size:0.7rem;color:${c.pago ? "var(--verde)" : "var(--vermelho)"};">${c.pago ? "Pago" : "Pendente"}</div>
              </div>
            </div>`;
          })
          .join("");
      }

      html += `</div>`;
      result.innerHTML = html;
    } catch (e) {
      result.innerHTML = `<div style="padding:12px;color:var(--texto-suave);font-size:0.82rem;">Erro ao buscar.</div>`;
    }
  },

  // ══════════════════════════════════════════
  // CONFIRMAÇÃO DE PAGAMENTO COM WHATSAPP
  // ══════════════════════════════════════════
  async baixarFaturaMes() {
    this.abrirConfirmacao(
      "Confirmar pagamento",
      "Marcar fatura como paga?",
      async () => {
        const propId = this.proprietarioAtualId;
        const mes = this.dataFiltroProp.getMonth() + 1;
        const ano = this.dataFiltroProp.getFullYear();
        const nome = document.getElementById("tituloDetalhesProp").textContent;
        const tel = document.getElementById(
          "subtituloDetalhesProp",
        ).textContent;

        await ApiService.putData("/api/gestao/custos/baixar-mes", {
          proprietario_id: propId,
          mes,
          ano,
        });

        // Busca total pago para a mensagem
        const nomesMeses = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ];
        const periodo = `${nomesMeses[mes - 1]} ${ano}`;

        this.carregarFaturaProprietario(propId, nome, tel);
        this.mostrarNotificacao("Pagamento confirmado!");

        // Pergunta se quer enviar confirmação via WhatsApp
        if (tel && tel !== "Sem telefone") {
          const telLimpo = tel.replace(/\D/g, "");
          setTimeout(() => {
            this.abrirConfirmacao(
              "Enviar confirmação?",
              `Enviar mensagem de confirmação para ${nome} via WhatsApp?`,
              () => {
                const msg = `Olá *${nome}*! ✅\n\nConfirmamos o recebimento do pagamento referente a *${periodo}*.\n\nObrigado pela pontualidade! 🤝\n\n${this.nomeRancho || "HF Controll"}`;
                window.open(
                  `https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`,
                  "_blank",
                );
              },
            );
          }, 400);
        }
      },
    );
  },

  async estornarFaturaMes() {
    this.abrirConfirmacao(
      "Estornar pagamento",
      "Tem certeza? Isso vai marcar a fatura como pendente novamente.",
      async () => {
        const propId = this.proprietarioAtualId;
        const mes = this.dataFiltroProp.getMonth() + 1;
        const ano = this.dataFiltroProp.getFullYear();
        const nome = document.getElementById("tituloDetalhesProp").textContent;
        const tel = document.getElementById(
          "subtituloDetalhesProp",
        ).textContent;
        try {
          await ApiService.putData("/api/gestao/custos/estornar-mes", {
            proprietario_id: propId,
            mes,
            ano,
          });
          this.carregarFaturaProprietario(propId, nome, tel);
          this.mostrarNotificacao("Pagamento estornado.");
        } catch (e) {
          this.mostrarNotificacao("Erro ao estornar.", "erro");
        }
      },
    );
  },

  // ══════════════════════════════════════════
  // AUTOCOMPLETE DE LOCAL
  // ══════════════════════════════════════════
  async carregarSugestoesLocais() {
    try {
      const locais = await ApiService.fetchData("/api/gestao/locais");
      const dl = document.getElementById("sugestoesLocais");
      if (!dl || !locais) return;
      dl.innerHTML = locais.map((l) => `<option value="${l}">`).join("");
    } catch (e) {}
  },

  // ══════════════════════════════════════════
  // LANÇAMENTO EM LOTE
  // ══════════════════════════════════════════
  async abrirModalLoteMensalidade() {
    this.vibrar();
    if (!this.bsModalLote) {
      this.bsModalLote = new bootstrap.Modal(
        document.getElementById("modalLoteMensalidade"),
      );
    }

    // Preenche mês/ano atual
    const hoje = new Date();
    document.getElementById("loteMes").value = hoje.getMonth() + 1;
    document.getElementById("loteAno").value = hoje.getFullYear();

    // Busca animais do cliente atual
    const propId = this.proprietarioAtualId;
    const todos = await ApiService.fetchData("/api/gestao/cavalos");
    const meus = (todos || []).filter((c) => c.proprietario_id == propId);

    const lista = document.getElementById("loteAnimaisLista");
    if (!meus.length) {
      lista.innerHTML = `<div class="text-muted small">Nenhum animal cadastrado.</div>`;
    } else {
      lista.innerHTML = meus
        .map(
          (c) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--bege-borda);">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="avatar-circle avatar-cavalo" style="width:28px;height:28px;font-size:11px;">${c.nome.charAt(0)}</div>
            <span style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${c.nome}</span>
          </div>
          <input type="text" inputmode="decimal" placeholder="R$ valor" data-cavalo="${c.id}"
            style="width:100px;border:0.5px solid var(--bege-borda);border-radius:10px;padding:5px 8px;font-size:0.8rem;text-align:right;background:var(--bege-fundo);" class="lote-valor-individual"/>
        </div>`,
        )
        .join("");
    }

    this.bsModalLote.show();
  },

  async confirmarLoteMensalidade() {
    this.vibrar();
    const mes = parseInt(document.getElementById("loteMes").value);
    const ano = parseInt(document.getElementById("loteAno").value);
    const vPad =
      parseFloat(
        (document.getElementById("loteValor").value || "0").replace(",", "."),
      ) || 0;
    const propId = this.proprietarioAtualId;

    // Coleta valores individuais
    const itens = [];
    document.querySelectorAll(".lote-valor-individual").forEach((inp) => {
      const val = parseFloat(inp.value.replace(",", "."));
      if (!isNaN(val) && val > 0) {
        itens.push({ cavalo_id: inp.dataset.cavalo, valor: val });
      }
    });

    try {
      const res = await ApiService.postData("/api/gestao/mensalidades/lote", {
        proprietario_id: propId,
        mes,
        ano,
        valor_padrao: vPad,
        itens,
      });
      this.bsModalLote.hide();
      this.mostrarNotificacao(res.message || "Lançado!");
      this.carregarFaturaProprietario(
        propId,
        document.getElementById("tituloDetalhesProp").textContent,
        document.getElementById("subtituloDetalhesProp").textContent,
      );
    } catch (e) {
      this.mostrarNotificacao("Erro ao lançar.", "erro");
    }
  },

  // ══════════════════════════════════════════
  // FICHA VETERINÁRIA
  // ══════════════════════════════════════════
  abrirFichaVet(id, nome) {
    this.vibrar();
    this.animalVetAtual = id;
    document.getElementById("tituloFichaVet").textContent = "Ficha Veterinária";
    document.getElementById("subtituloFichaVet").textContent = nome;

    // Data padrão = hoje
    document.getElementById("vetDataEvento").value = new Date()
      .toISOString()
      .split("T")[0];
    document.getElementById("vetTipo").value = "";
    document.getElementById("vetDescricao").value = "";
    document.getElementById("vetProfissional").value = "";
    document.getElementById("vetProximaData").value = "";

    if (!this.bsModalFichaVet) {
      this.bsModalFichaVet = new bootstrap.Modal(
        document.getElementById("modalFichaVet"),
      );
    }
    this.bsModalFichaVet.show();
    this.carregarFichaVet(id);
  },

  async carregarFichaVet(cavaloId) {
    const lista = document.getElementById("listaFichaVet");
    if (!lista) return;
    lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;

    try {
      const dados = await ApiService.fetchData(
        `/api/gestao/veterinario/${cavaloId}`,
      );
      if (!dados || !dados.length) {
        lista.innerHTML = `
          <div style="text-align:center;padding:2rem 1rem;">
            <div style="font-size:2.5rem;color:var(--bege-borda);margin-bottom:10px;"><i class="fa-solid fa-stethoscope"></i></div>
            <p style="color:var(--texto-suave);font-size:0.85rem;">Nenhum registro veterinário ainda.</p>
          </div>`;
        return;
      }

      const icones = {
        Ferradura: "fa-shoe-prints",
        Vacina: "fa-syringe",
        Vermifugação: "fa-pills",
        Consulta: "fa-stethoscope",
        Exame: "fa-microscope",
        Outro: "fa-notes-medical",
      };
      const cores = {
        Ferradura: "#8B5230",
        Vacina: "#3D7A5E",
        Vermifugação: "#7A52A0",
        Consulta: "#5B8DC9",
        Exame: "#C49A4A",
        Outro: "#8A6840",
      };

      lista.innerHTML = dados
        .map((r) => {
          const cor = cores[r.tipo] || cores["Outro"];
          const icone = icones[r.tipo] || icones["Outro"];
          const dtEvt = new Date(r.data_evento).toLocaleDateString("pt-BR");
          const dtProx = r.proxima_data
            ? new Date(r.proxima_data).toLocaleDateString("pt-BR")
            : null;
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const diffDias = r.proxima_data
            ? Math.ceil((new Date(r.proxima_data) - hoje) / 86400000)
            : null;
          const alertaProx =
            diffDias !== null
              ? diffDias < 0
                ? `<span style="background:rgba(168,50,50,0.1);color:var(--vermelho);border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;">Vencida</span>`
                : diffDias <= 7
                  ? `<span style="background:rgba(196,154,74,0.12);color:var(--dourado);border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;">Vence em ${diffDias}d</span>`
                  : `<span style="font-size:0.72rem;color:var(--texto-suave);">Próxima: ${dtProx}</span>`
              : "";

          return `
          <div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-left:3px solid ${cor};border-radius:14px;padding:11px 13px;margin-bottom:8px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="display:flex;align-items:center;gap:9px;flex:1;">
                <div style="width:32px;height:32px;border-radius:10px;background:${cor}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="fa-solid ${icone}" style="color:${cor};font-size:0.85rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;color:var(--texto-titulo);font-size:0.88rem;">${r.tipo}</div>
                  ${r.descricao ? `<div style="font-size:0.75rem;color:var(--texto-suave);margin-top:2px;">${r.descricao}</div>` : ""}
                  ${r.profissional ? `<div style="font-size:0.72rem;color:var(--texto-suave);">Prof: ${r.profissional}</div>` : ""}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:0.75rem;font-weight:600;color:var(--texto-titulo);">${dtEvt}</div>
                ${alertaProx}
                <button onclick="RanchoApp.excluirFichaVet(${r.id})"
                  style="background:none;border:none;color:var(--texto-suave);cursor:pointer;font-size:0.75rem;margin-top:4px;padding:0;">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>`;
        })
        .join("");
    } catch (e) {
      console.error("carregarFichaVet:", e);
    }
  },

  async salvarFichaVet() {
    const tipo = document.getElementById("vetTipo").value;
    const dataEvento = document.getElementById("vetDataEvento").value;
    if (!tipo || !dataEvento) {
      this.mostrarNotificacao("Preencha tipo e data.", "erro");
      return;
    }

    try {
      await ApiService.postData("/api/gestao/veterinario", {
        cavalo_id: this.animalVetAtual,
        tipo,
        descricao: document.getElementById("vetDescricao").value,
        data_evento: dataEvento,
        proxima_data: document.getElementById("vetProximaData").value || null,
        profissional: document.getElementById("vetProfissional").value,
      });
      // Limpa form
      document.getElementById("vetTipo").value = "";
      document.getElementById("vetDescricao").value = "";
      document.getElementById("vetProfissional").value = "";
      document.getElementById("vetProximaData").value = "";
      this.mostrarNotificacao("Registrado!");
      this.carregarFichaVet(this.animalVetAtual);
    } catch (e) {
      this.mostrarNotificacao("Erro ao salvar.", "erro");
    }
  },

  excluirFichaVet(id) {
    this.abrirConfirmacao("Excluir", "Apagar este registro?", async () => {
      await ApiService.deleteData(`/api/gestao/veterinario/${id}`);
      this.carregarFichaVet(this.animalVetAtual);
      this.mostrarNotificacao("Apagado!");
    });
  },
  // ── Config ──
  abrirModalConfig() {
    this.vibrar();
    this.bsModalConfig.show();
  },
  async salvarConfig(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, "Salvando...");
    try {
      const pix = document.getElementById("configChavePix").value;
      await ApiService.putData("/api/gestao/config", { chave_pix: pix });
      this.chavePixCache = pix;
      this.bsModalConfig.hide();
      this.mostrarNotificacao("Chave PIX salva!");
    } catch (e) {
      this.mostrarNotificacao("Erro ao salvar.", "erro");
    } finally {
      this.setLoading(btn, false, "Salvar");
    }
  },
  async carregarConfiguracoes() {
    try {
      const r = await ApiService.fetchData("/api/gestao/perfil");
      if (r) {
        this.chavePixCache = r.chave_pix || "";
        const inp = document.getElementById("configChavePix");
        if (inp) inp.value = this.chavePixCache;
      }
    } catch (e) {}
  },

  // ── Utilitários ──
  vibrar(ms = 50) {
    if (navigator.vibrate) navigator.vibrate(ms);
  },
  mascaraTelefone(e) {
    e.target.value = e.target.value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d)(\d{4})$/, "$1-$2");
  },
  mascaraMoeda(e) {
    let v = e.target.value.replace(/\D/g, "");
    v = (Number(v) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    e.target.value = v;
  },
  limparMoeda(v) {
    if (!v) return 0;
    return parseFloat(v.replace(/[^\d,]/g, "").replace(",", "."));
  },
  setLoading(btn, l, t) {
    if (l) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = t;
    }
  },
  mostrarNotificacao(msg, tipo = "sucesso") {
    const tm = document.getElementById("toastMessage"),
      te = document.getElementById("liveToast");
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
    nb.onclick = () => {
      this.bsModalConfirm.hide();
      this.vibrar();
      cb();
    };
    this.bsModalConfirm.show();
  },
};

document.addEventListener("DOMContentLoaded", () => RanchoApp.init());
