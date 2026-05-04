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
    this.setSaudacao();

    await this.carregarConfiguracoes();
    await this.carregarProprietariosSelect();
    await this.carregarHome();
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
    const btn = document.getElementById("btnDarkMode");
    if (localStorage.getItem("theme") === "dark") {
      document.body.setAttribute("data-theme", "dark");
      btn.querySelector("i").classList.replace("fa-moon", "fa-sun");
    }
    btn?.addEventListener("click", () => {
      this.vibrar();
      const dark = document.body.getAttribute("data-theme") === "dark";
      document.body[dark ? "removeAttribute" : "setAttribute"](
        "data-theme",
        "dark",
      );
      localStorage.setItem("theme", dark ? "light" : "dark");
      btn
        .querySelector("i")
        .classList.replace(
          dark ? "fa-sun" : "fa-moon",
          dark ? "fa-moon" : "fa-sun",
        );
    });
  },

  // ── Pull to Refresh ──
  setupPullToRefresh() {
    let startY = 0,
      currentY = 0,
      isPulling = false;
    const ptr = document.getElementById("ptrIndicator");
    document.addEventListener(
      "touchstart",
      (e) => {
        if (!window.scrollY) {
          startY = e.touches[0].clientY;
          isPulling = true;
        }
      },
      { passive: true },
    );
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].clientY;
        const d = currentY - startY;
        if (d > 0 && !window.scrollY) {
          if (e.cancelable) e.preventDefault();
          ptr.style.transform = `translateY(${Math.min(d / 2, 70)}px)`;
          ptr.style.opacity = Math.min(d / 100, 1);
        } else isPulling = false;
      },
      { passive: false },
    );
    document.addEventListener("touchend", async () => {
      if (!isPulling) return;
      isPulling = false;
      const d = currentY - startY;
      if (d > 60) {
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
    else if (this.abaAtual === "rancho") await this.carregarDespesasRancho();
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
    await Promise.all([
      this.carregarKPIs(),
      this.carregarHistorico(),
      this.carregarDespesasCategorias(),
      this.carregarAlertas(),
      this.carregarAnimaisHome(),
    ]);
  },

  async carregarKPIs() {
    try {
      const d = await ApiService.fetchData("/api/dashboard/kpis");
      if (!d) return;

      document.getElementById("kpiAnimais").textContent = d.animais.total;
      const trendA = document.getElementById("kpiAnimaisTrend");
      trendA.className = "kpi-trend neu";
      trendA.textContent =
        d.animais.novos > 0 ? `+${d.animais.novos} este mês` : "Nenhum novo";

      const recF = d.receita.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      document.getElementById("kpiReceita").textContent = recF;
      const trendR = document.getElementById("kpiReceitaTrend");
      if (d.receita.pct !== null) {
        trendR.className = `kpi-trend ${d.receita.pct >= 0 ? "up" : "dn"}`;
        trendR.textContent = `${d.receita.pct > 0 ? "+" : ""}${d.receita.pct}% vs mês ant.`;
      } else {
        trendR.className = "kpi-trend neu";
        trendR.textContent = "Primeiro mês";
      }

      document.getElementById("kpiClientes").textContent = d.clientes.total;
      const trendC = document.getElementById("kpiClientesTrend");
      trendC.className = "kpi-trend neu";
      trendC.textContent =
        d.clientes.novos > 0 ? `+${d.clientes.novos} novos` : "Nenhum novo";

      const despF = d.despesas.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      document.getElementById("kpiDespesas").textContent = despF;
      const trendD = document.getElementById("kpiDespesasTrend");
      if (d.despesas.pct !== null) {
        trendD.className = `kpi-trend ${d.despesas.pct <= 0 ? "up" : "dn"}`;
        trendD.textContent = `${d.despesas.pct > 0 ? "+" : ""}${d.despesas.pct}% vs mês ant.`;
      } else {
        trendD.className = "kpi-trend neu";
        trendD.textContent = "Primeiro mês";
      }
    } catch (e) {
      console.error("KPIs:", e);
    }
  },

  async carregarHistorico() {
    try {
      const dados = await ApiService.fetchData("/api/dashboard/historico");
      if (!dados || !dados.length) return;
      const ctx = document.getElementById("graficoHistorico");
      if (!ctx) return;
      if (this.chartHistorico) this.chartHistorico.destroy();
      this.chartHistorico = new Chart(ctx, {
        type: "line",
        data: {
          labels: dados.map((d) => d.label),
          datasets: [
            {
              label: "Receita",
              data: dados.map((d) => d.receita),
              borderColor: "#3D7A5E",
              backgroundColor: "rgba(61,122,94,0.08)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#3D7A5E",
              pointRadius: 4,
            },
            {
              label: "Despesas",
              data: dados.map((d) => d.despesas),
              borderColor: "#A83232",
              backgroundColor: "rgba(168,50,50,0.06)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#A83232",
              pointRadius: 4,
              borderDash: [4, 3],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: "#8A6840" },
            },
            y: {
              grid: { color: "rgba(196,154,74,0.1)" },
              ticks: {
                font: { size: 10 },
                color: "#8A6840",
                callback: (v) => "R$" + v,
              },
            },
          },
        },
      });
    } catch (e) {
      console.error("Histórico:", e);
    }
  },

  async carregarDespesasCategorias() {
    const wrap = document.getElementById("graficoCategorias");
    if (!wrap) return;
    try {
      const dados = await ApiService.fetchData(
        "/api/dashboard/despesas-categorias",
      );
      if (!dados || !dados.length) {
        wrap.innerHTML = `<div class="text-center py-3" style="color:var(--texto-suave);font-size:0.82rem;">Nenhuma despesa este mês.</div>`;
        return;
      }
      const total = dados.reduce((s, d) => s + parseFloat(d.total), 0);
      const cores = [
        "#8B5230",
        "#C49A4A",
        "#7A52A0",
        "#3D7A5E",
        "#A83232",
        "#5B8DC9",
      ];
      wrap.innerHTML = dados
        .map((d, i) => {
          const pct =
            total > 0 ? Math.round((parseFloat(d.total) / total) * 100) : 0;
          const valF = parseFloat(d.total).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          return `
          <div class="bar-item">
            <div class="bar-top">
              <span class="bar-top-label">${d.categoria}</span>
              <span class="bar-top-val">${valF} <span style="color:var(--texto-suave);font-size:0.7rem;">(${pct}%)</span></span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${cores[i % cores.length]};"></div></div>
          </div>`;
        })
        .join("");
    } catch (e) {
      wrap.innerHTML = `<div style="color:var(--texto-suave);font-size:0.82rem;">Erro ao carregar.</div>`;
    }
  },

  async carregarAlertas() {
    const wrap = document.getElementById("listaAlertas");
    if (!wrap) return;
    try {
      const dados = await ApiService.fetchData("/api/dashboard/alertas");
      if (!dados || !dados.length) {
        wrap.innerHTML = `<div style="padding:0 14px 8px;color:var(--texto-suave);font-size:0.82rem;">Nenhum lembrete no momento.</div>`;
        return;
      }
      const icones = { vencido: "vencido", pago: "pago", atencao: "atencao" };
      wrap.innerHTML = dados
        .slice(0, 4)
        .map(
          (a) => `
        <div class="alerta-item">
          <div class="alerta-dot ${icones[a.tipo] || "atencao"}"></div>
          <div style="flex:1;">
            <div class="alerta-titulo">${a.titulo}</div>
            <div class="alerta-sub">${a.sub}${a.valor ? ` — ${parseFloat(a.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}</div>
          </div>
          <span class="alerta-tempo">${a.tempo}</span>
        </div>`,
        )
        .join("");
    } catch (e) {
      wrap.innerHTML = `<div style="padding:0 14px;color:var(--texto-suave);font-size:0.82rem;">Erro ao carregar alertas.</div>`;
    }
  },

  async carregarAnimaisHome() {
    const wrap = document.getElementById("listaAnimaisHome");
    if (!wrap) return;
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      if (!cavalos || !cavalos.length) {
        wrap.innerHTML = `<div style="padding:0 14px 12px;color:var(--texto-suave);font-size:0.82rem;">Nenhum animal cadastrado.</div>`;
        return;
      }
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();
      const lista = await Promise.all(
        cavalos.slice(0, 4).map(async (c) => {
          const fin = await ApiService.fetchData(
            `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
          );
          const pendente =
            fin.custos &&
            fin.custos.some((x) => x.pago == 0 || x.pago === false);
          return { ...c, total: parseFloat(fin.total_gasto || 0), pendente };
        }),
      );
      wrap.innerHTML = lista
        .map((c) => {
          const ns = c.nome.replace(/'/g, "\\'");
          const totalF = c.total.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          const dotClr = c.pendente ? "#E53935" : "var(--verde)";
          const badgeC = c.total > 0 ? "badge-pendente" : "badge-pago";
          const badgeTx = c.total > 0 ? `${totalF} pend.` : "Em dia";
          return `
          <div class="animal-card">
            <div class="animal-card-top" onclick="RanchoApp.abrirModalEditar(${c.id},'${ns}','${(c.lugar || "").replace(/'/g, "\\'")}','${c.proprietario_id || ""}','${(c.observacoes || "").replace(/'/g, "\\'")}')">
              <div class="avatar-circle avatar-cavalo">${c.nome.charAt(0).toUpperCase()}</div>
              <div style="flex:1;min-width:0;">
                <div class="animal-nome">
                  ${c.nome}
                  <span class="status-dot" style="background:${dotClr};${c.pendente ? "box-shadow:0 0 5px rgba(229,57,53,0.5);" : ""}"></span>
                </div>
                <div class="animal-sub">
                  <span class="tag-local"><i class="fa-solid fa-location-dot" style="font-size:0.62rem;color:var(--marrom-claro);"></i>${c.lugar || "Sem local"}</span>
                  ${c.nome_proprietario ? `<span class="tag-prop"><i class="fa-solid fa-user" style="font-size:0.62rem;"></i>${c.nome_proprietario}</span>` : ""}
                </div>
              </div>
              <span class="badge-status ${badgeC}">${badgeTx}</span>
            </div>
            <div class="animal-card-base">
              <div>
                <div class="gasto-label">Gasto no mês</div>
                <div class="gasto-valor">${totalF}</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn-action icon-brown" onclick="RanchoApp.abrirMensalidade(${c.id},'${ns}')" title="Mensalidade"><i class="fa-solid fa-calendar-plus" style="font-size:0.82rem;"></i></button>
                <button class="btn-action icon-gold" onclick="RanchoApp.abrirFinanceiro(${c.id},'${ns}')" title="Custos"><i class="fa-solid fa-coins" style="font-size:0.82rem;"></i></button>
              </div>
            </div>
          </div>`;
        })
        .join("");
    } catch (e) {
      console.error("AnimaisHome:", e);
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
      rancho: "tabRancho",
    };
    const navs = {
      home: "navBtnHome",
      cavalos: "navBtnCavalos",
      proprietarios: "navBtnProps",
      rancho: "navBtnRancho",
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
    const tabEl = document.getElementById(tabs[aba]);
    if (tabEl) {
      tabEl.classList.remove("d-none");
      void tabEl.offsetWidth;
      tabEl.classList.add("fade-in-up");
    }
    document.getElementById(navs[aba])?.classList.add("active");
    if (aba === "home") this.carregarHome();
    else if (aba === "cavalos") this.carregarTabelaCavalos();
    else if (aba === "proprietarios") this.carregarTabelaProprietarios();
    else if (aba === "rancho") {
      this.dataFiltroRancho = new Date();
      this.atualizarLabelMesRancho();
      this.carregarDespesasRancho();
    }
  },

  adicionarItemAtual() {
    this.vibrar();
    if (this.abaAtual === "cavalos") this.abrirModalNovoCavalo();
    else if (this.abaAtual === "proprietarios")
      this.abrirModalGerenciarProprietarios();
    else if (this.abaAtual === "rancho")
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
    const mes = this.dataFiltroRancho.getMonth() + 1,
      ano = this.dataFiltroRancho.getFullYear();
    const tbody = document.getElementById("listaRanchoBody");
    if (!tbody) return;
    tbody.innerHTML = this.skeletonRows(3);
    try {
      const dados = await ApiService.fetchData(
        `/api/gestao/custos/rancho?mes=${mes}&ano=${ano}`,
      );
      tbody.innerHTML = "";
      const icones = {
        Alimentação: "fa-wheat-awn",
        Manutenção: "fa-hammer",
        Funcionários: "fa-user-clock",
        Energia: "fa-bolt",
        Combustível: "fa-gas-pump",
        Outros: "fa-circle-question",
      };
      if (dados?.custos?.length) {
        let lista = dados.custos;
        if (this.categoriaFiltroRancho)
          lista = lista.filter(
            (c) => c.categoria === this.categoriaFiltroRancho,
          );
        if (!lista.length) {
          document.getElementById("areaGraficoRancho").style.display = "none";
          tbody.innerHTML = `<tr><td class="text-center py-5 text-muted small">Nenhuma despesa nesta categoria.</td></tr>`;
          document.getElementById("totalRanchoMesDisplay").textContent =
            "R$ 0,00";
          return;
        }
        document.getElementById("areaGraficoRancho").style.display = "block";
        this.renderGraficoRancho(lista);
        let total = 0;
        lista
          .sort((a, b) => parseFloat(b.valor) - parseFloat(a.valor))
          .forEach((c) => {
            total += parseFloat(c.valor);
            const dia = new Date(c.data_despesa).getDate();
            const valF = parseFloat(c.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const ico = icones[c.categoria] || "fa-tag";
            tbody.innerHTML += `
            <tr style="border-bottom:0.5px solid var(--bege-borda);">
              <td style="padding:12px 16px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:38px;height:38px;border-radius:12px;background:rgba(196,154,74,0.1);display:flex;align-items:center;justify-content:center;color:var(--marrom-claro);font-size:0.95rem;flex-shrink:0;">
                    <i class="fa-solid ${ico}"></i>
                  </div>
                  <div>
                    <div style="font-weight:600;color:var(--texto-titulo);font-size:0.88rem;">${c.descricao}</div>
                    <div style="font-size:0.72rem;color:var(--texto-suave);">${c.categoria} · Dia ${dia}</div>
                  </div>
                </div>
              </td>
              <td style="padding:12px 16px;text-align:right;">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">
                  <span style="font-weight:700;color:var(--vermelho);font-size:0.88rem;">${valF}</span>
                  <button class="btn-action icon-red" style="width:34px;height:34px;" onclick="RanchoApp.excluirCustoRancho(${c.id})"><i class="fa-solid fa-trash-can" style="font-size:0.75rem;"></i></button>
                </div>
              </td>
            </tr>`;
          });
        document.getElementById("totalRanchoMesDisplay").textContent =
          total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        document.getElementById("totalRanchoMes") &&
          (document.getElementById("totalRanchoMes").textContent = parseFloat(
            dados.total_gasto,
          ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
      } else {
        document.getElementById("areaGraficoRancho").style.display = "none";
        tbody.innerHTML = `<tr><td class="text-center border-0 py-5"><div style="font-size:2.5rem;color:var(--bege-borda);margin-bottom:8px;"><i class="fa-solid fa-clipboard-check"></i></div><p style="color:var(--texto-suave);font-family:'Lora',serif;font-weight:600;margin:0;">Tudo tranquilo!</p><small style="color:var(--texto-suave);">Nenhuma despesa lançada.</small></td></tr>`;
        document.getElementById("totalRanchoMesDisplay").textContent =
          "R$ 0,00";
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td class="text-center text-danger py-4">Erro ao carregar.</td></tr>`;
    }
  },

  renderGraficoRancho(custos) {
    const ctx = document.getElementById("graficoRancho");
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
    this.atualizarLabelMesRancho();
    this.carregarDespesasRancho();
  },
  atualizarLabelMesRancho() {
    const el = document.getElementById("labelMesAnoRancho");
    if (el)
      el.textContent = this.dataFiltroRancho
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .toUpperCase();
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
      this.filtrarCategoriaRancho("");
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
        this.carregarDespesasRancho();
        this.mostrarNotificacao("Apagado!");
      } catch (e) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },

  // ── Cards Animais ──
  skeletonRows(n) {
    return Array(n)
      .fill(
        `<div class="animal-card mb-0" style="margin:0 0 10px!important;"><div style="display:flex;gap:12px;"><div class="skeleton skeleton-avatar"></div><div style="flex:1;"><div class="skeleton skeleton-text medium"></div><div class="skeleton skeleton-text short" style="margin-top:6px;"></div></div></div></div>`,
      )
      .join("");
  },

  async carregarTabelaCavalos() {
    const wrap = document.getElementById("listaCavalosBody");
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:0 14px;">${this.skeletonRows(4)}</div>`;
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      wrap.innerHTML = "";
      if (!cavalos || !cavalos.length) {
        wrap.innerHTML = `<div style="text-align:center;padding:3rem 1rem;"><div style="font-size:3rem;color:var(--bege-borda);margin-bottom:12px;"><i class="fa-solid fa-horse-head"></i></div><p style="color:var(--texto-suave);font-family:'Lora',serif;font-weight:600;margin-bottom:12px;">Nenhum animal cadastrado</p><button class="btn btn-primary rounded-pill px-4" onclick="RanchoApp.abrirModalNovoCavalo()"><i class="fa-solid fa-plus me-1"></i> Cadastrar</button></div>`;
        return;
      }
      const hoje = new Date(),
        mes = hoje.getMonth() + 1,
        ano = hoje.getFullYear();
      const ordem = document.getElementById("inputOrdenacao")?.value || "az";
      const lista = await Promise.all(
        cavalos.map(async (c) => {
          const fin = await ApiService.fetchData(
            `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
          );
          const pendente =
            fin.custos &&
            fin.custos.some((x) => x.pago == 0 || x.pago === false);
          return {
            ...c,
            totalSort: parseFloat(fin.total_gasto || 0),
            pendente,
            totalFormatado: parseFloat(fin.total_gasto || 0).toLocaleString(
              "pt-BR",
              { style: "currency", currency: "BRL" },
            ),
          };
        }),
      );
      this.ordenarLista(lista, ordem).forEach((c) => {
        const ns = c.nome.replace(/'/g, "\\'"),
          ls = (c.lugar || "").replace(/'/g, "\\'"),
          os = (c.observacoes || "").replace(/'/g, "\\'");
        const dotClr = c.pendente ? "#E53935" : "var(--verde)";
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="animal-card">
            <div class="animal-card-top" onclick="RanchoApp.abrirModalEditar(${c.id},'${ns}','${ls}','${c.proprietario_id || ""}','${os}')">
              <div class="avatar-circle avatar-cavalo">${c.nome.charAt(0).toUpperCase()}</div>
              <div style="flex:1;min-width:0;">
                <div class="animal-nome">${c.nome}<span class="status-dot" style="background:${dotClr};${c.pendente ? "box-shadow:0 0 5px rgba(229,57,53,0.5);" : ""}"></span></div>
                <div class="animal-sub">
                  <span class="tag-local"><i class="fa-solid fa-location-dot" style="font-size:0.62rem;color:var(--marrom-claro);"></i>${c.lugar || "Sem local"}</span>
                  ${c.nome_proprietario ? `<span class="tag-prop"><i class="fa-solid fa-user" style="font-size:0.62rem;"></i>${c.nome_proprietario}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="animal-card-base">
              <div><div class="gasto-label">Gasto no mês</div><div class="gasto-valor">${c.totalFormatado}</div></div>
              <div style="display:flex;gap:8px;">
                <button class="btn-action icon-brown" onclick="RanchoApp.abrirMensalidade(${c.id},'${ns}')" title="Mensalidade"><i class="fa-solid fa-calendar-plus" style="font-size:0.82rem;"></i></button>
                <button class="btn-action icon-gold" onclick="RanchoApp.abrirFinanceiro(${c.id},'${ns}')" title="Custos"><i class="fa-solid fa-coins" style="font-size:0.82rem;"></i></button>
              </div>
            </div>
          </div>`;
        wrap.appendChild(el.firstElementChild);
      });
    } catch (e) {
      console.error(e);
    }
  },

  // ── Cards Clientes ──
  async carregarTabelaProprietarios() {
    const wrap = document.getElementById("listaProprietariosMainBody");
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:0 14px;">${this.skeletonRows(3)}</div>`;
    try {
      const props = await ApiService.fetchData("/api/gestao/proprietarios");
      const cavalos = (await ApiService.fetchData("/api/gestao/cavalos")) || [];
      wrap.innerHTML = "";
      if (!props || !props.length) {
        wrap.innerHTML = `<div style="text-align:center;padding:3rem 1rem;"><div style="font-size:3rem;color:var(--bege-borda);margin-bottom:12px;"><i class="fa-solid fa-users"></i></div><p style="color:var(--texto-suave);font-family:'Lora',serif;font-weight:600;margin-bottom:12px;">Nenhum cliente</p><button class="btn btn-primary rounded-pill px-4" onclick="RanchoApp.abrirModalGerenciarProprietarios()"><i class="fa-solid fa-plus me-1"></i> Novo Cliente</button></div>`;
        return;
      }
      const hoje = new Date(),
        mes = hoje.getMonth() + 1,
        ano = hoje.getFullYear();
      const ordem = document.getElementById("inputOrdenacao")?.value || "az";
      const lista = await Promise.all(
        props.map(async (p) => {
          const meus = cavalos.filter((c) => c.proprietario_id == p.id);
          let divida = 0;
          for (const c of meus) {
            const r = await ApiService.fetchData(
              `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
            );
            if (r.custos)
              r.custos.forEach((x) => {
                if (!x.pago) divida += parseFloat(x.valor);
              });
          }
          const dir = await ApiService.fetchData(
            `/api/gestao/custos/diretos/${p.id}?mes=${mes}&ano=${ano}`,
          );
          if (dir)
            dir.forEach((x) => {
              if (!x.pago) divida += parseFloat(x.valor);
            });
          return {
            ...p,
            totalSort: divida,
            txtAnimais:
              meus.length === 1 ? "1 animal" : `${meus.length} animais`,
            temPendencia: divida > 0,
            txtValor:
              divida > 0
                ? divida.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "Pago",
          };
        }),
      );
      this.ordenarLista(lista, ordem).forEach((p) => {
        const dotClr = p.temPendencia ? "#E53935" : "var(--verde)";
        const badgeBg = p.temPendencia
          ? "rgba(168,50,50,0.09)"
          : "rgba(61,122,94,0.09)";
        const badgeClr = p.temPendencia ? "#7B1A1A" : "#1B5E20";
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="animal-card" style="display:flex;align-items:center;gap:12px;">
            <div class="avatar-circle avatar-dono" style="flex-shrink:0;">${p.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;cursor:pointer;" onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${p.nome}','${p.telefone || ""}')">
              <div class="animal-nome">${p.nome}<span class="status-dot" style="background:${dotClr};${p.temPendencia ? "box-shadow:0 0 5px rgba(229,57,53,0.5);" : ""}"></span></div>
              <div class="animal-sub">
                <span style="font-size:0.72rem;color:var(--marrom-claro);font-weight:600;"><i class="fa-solid fa-horse-head" style="font-size:0.62rem;"></i> ${p.txtAnimais}</span>
                ${p.telefone ? `<span class="tag-prop"><i class="fa-solid fa-phone" style="font-size:0.62rem;"></i>${p.telefone}</span>` : ""}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
              <span style="background:${badgeBg};color:${badgeClr};border-radius:10px;padding:3px 10px;font-size:0.75rem;font-weight:700;white-space:nowrap;">${p.txtValor}</span>
              <button class="btn-action icon-brown" style="width:32px;height:32px;" onclick="RanchoApp.abrirModalGerenciarProprietarios(${p.id},'${p.nome}','${p.telefone || ""}')" title="Editar"><i class="fa-solid fa-pen" style="font-size:0.72rem;"></i></button>
            </div>
          </div>`;
        wrap.appendChild(el.firstElementChild);
      });
    } catch (e) {
      console.error(e);
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
  abrirModalNovoCavalo() {
    this.vibrar();
    document.getElementById("formCavalo").reset();
    document.getElementById("cavaloId").value = "";
    document.getElementById("tituloModalCavalo").textContent = "Novo Animal";
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
    const body = {
      nome: document.getElementById("cavaloNome").value,
      lugar: document.getElementById("cavaloLugar").value,
      proprietario_id: document.getElementById("cavaloProprietario").value,
      observacoes: document.getElementById("cavaloObs").value,
    };
    const id = document.getElementById("cavaloId").value;
    try {
      if (id) await ApiService.putData(`/api/gestao/cavalos/${id}`, body);
      else await ApiService.postData("/api/gestao/cavalos", body);
      this.bsModalCavalo.hide();
      this.carregarTabelaCavalos();
      if (this.abaAtual === "home") this.carregarHome();
      this.mostrarNotificacao("Salvo!");
    } catch (e) {
      this.mostrarNotificacao("Erro", "erro");
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
      } else {
        document.getElementById("totalGeralProp").innerHTML =
          '<span class="text-success"><i class="fa-solid fa-check-double me-2"></i>Pago</span>';
        btnB.disabled = true;
        btnB.className = "btn btn-success py-3 rounded-4 fw-bold opacity-50";
        btnB.innerHTML = "Fatura Quitada";
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
    this.mostrarNotificacao("Gerando texto...", "sucesso");
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1,
      ano = this.dataFiltroProp.getFullYear();
    let msg = `Ola *${nomeProp}*.\nSegue o fechamento de *${periodo}*:\n\n`;
    try {
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meus = allCavalos.filter((c) => c.proprietario_id == propId);
      for (const c of meus) {
        const d = await ApiService.fetchData(
          `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
        );
        let sub = 0;
        if (d.custos) d.custos.forEach((x) => (sub += parseFloat(x.valor)));
        if (sub > 0)
          msg += `*${c.nome}*: ${sub.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n`;
      }
      const dir = await ApiService.fetchData(
        `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
      );
      if (dir)
        dir.forEach((c) => {
          msg += `${c.descricao} (Avulso): ${parseFloat(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n`;
        });
      msg += `\n*TOTAL: ${totalTexto}*\n`;
      if (this.chavePixCache?.trim())
        msg += `\n*Chave PIX:*\n${this.chavePixCache}\n\nQualquer dúvida, estou à disposição!`;
      window.open(
        `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    } catch (e) {
      this.mostrarNotificacao("Erro ao gerar Zap.", "erro");
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
      const r = await ApiService.fetchData("/api/gestao/config");
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
