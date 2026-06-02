// ── Home / Dashboard ──────────────────────────────────────────
Object.assign(RanchoApp, {
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
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const h = agora.getHours();
    const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const primeiroNome = this.nomeUsuario ? this.nomeUsuario.split(" ")[0] : "";
    const saudacao = primeiroNome ? `${periodo}, ${primeiroNome}!` : `${periodo}!`;
    const dataTexto = `${dias[agora.getDay()]}-feira, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;

    const elSaud = document.getElementById("saudacaoLabel");
    if (elSaud) elSaud.textContent = saudacao;
    const elData = document.getElementById("dataHoje");
    if (elData) elData.textContent = dataTexto;

    const topSaud = document.getElementById("topbarSaudacao");
    if (topSaud) topSaud.textContent = saudacao;
    const topData = document.getElementById("topbarData");
    if (topData)
      topData.textContent = `${dias[agora.getDay()]}, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
  },

  async carregarKPIs() {
    try {
      const [d, cob] = await Promise.all([
        ApiService.fetchData("/api/dashboard/kpis"),
        ApiService.fetchData("/api/dashboard/cobrancas"),
      ]);
      if (!d) return;

      const elA = document.getElementById("kpiAnimais");
      const elAT = document.getElementById("kpiAnimaisTrend");
      if (elA) elA.textContent = d.animais.total;
      if (elAT) {
        elAT.className = "kpi-trend neu";
        elAT.textContent = d.animais.novos > 0 ? `+${d.animais.novos} este mês` : "Nenhum novo";
      }

      const elR = document.getElementById("kpiReceita");
      const elRT = document.getElementById("kpiReceitaTrend");
      if (elR) elR.textContent = d.receita.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (elRT) {
        if (d.receita.pct !== null) {
          elRT.className = `kpi-trend ${d.receita.pct >= 0 ? "up" : "dn"}`;
          elRT.textContent = `${d.receita.pct > 0 ? "+" : ""}${d.receita.pct}% vs mês ant.`;
        } else {
          elRT.className = "kpi-trend neu";
          elRT.textContent = "Primeiro mês";
        }
      }

      const elAt = document.getElementById("kpiAtraso");
      const elAtT = document.getElementById("kpiAtrasoTrend");
      if (elAt && cob)
        elAt.textContent = cob.totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      let qtdPendentes = 0;
      if (elAtT && cob) {
        qtdPendentes = new Set([
          ...(cob.pendentes || []).map((p) => p.proprietario_id),
          ...(cob.custosDiretos || []).map((c) => c.proprietario_id),
        ]).size;
        elAtT.className = `kpi-trend ${qtdPendentes > 0 ? "dn" : "up"}`;
        elAtT.textContent = qtdPendentes > 0 ? `${qtdPendentes} cliente${qtdPendentes !== 1 ? "s" : ""}` : "Tudo em dia";
      }

      const elD = document.getElementById("kpiDespesas");
      const elDT = document.getElementById("kpiDespesasTrend");
      if (elD) elD.textContent = d.despesas.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (elDT) {
        if (d.despesas.pct !== null) {
          elDT.className = `kpi-trend ${d.despesas.pct <= 0 ? "up" : "dn"}`;
          elDT.textContent = `${d.despesas.pct > 0 ? "+" : ""}${d.despesas.pct}% vs mês ant.`;
        } else {
          elDT.className = "kpi-trend neu";
          elDT.textContent = "Primeiro mês";
        }
      }

      this.atualizarBadge(qtdPendentes);
    } catch (e) {}
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
      wrap.innerHTML = dados.slice(0, 5).map((a) => {
        const cores = { vencido: "var(--vermelho)", pago: "var(--verde)", atencao: "var(--dourado)" };
        const cor = cores[a.tipo] || "var(--texto-suave)";
        const valF = a.valor ? ` · ${parseFloat(a.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "";
        return `
          <div class="alerta-item" style="cursor:default;">
            <div class="alerta-dot ${a.tipo}" style="background:${cor};${a.tipo === "vencido" ? "box-shadow:0 0 5px rgba(229,57,53,0.35);" : ""}"></div>
            <div style="flex:1;min-width:0;">
              <div class="alerta-titulo">${a.titulo}</div>
              <div class="alerta-sub">${a.sub}${valF}</div>
            </div>
            <span class="alerta-tempo">${a.tempo}</span>
          </div>`;
      }).join("");
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
      if (labelEl) labelEl.textContent = `${totalOcupados + totalSemLocal} anim${totalOcupados + totalSemLocal !== 1 ? "ais" : "al"}`;
      if (pctEl) pctEl.textContent = `${taxaOcupacao}%`;
      if (barraEl) barraEl.style.width = `${taxaOcupacao}%`;

      const todos = [];
      dados.grupos.forEach((g) =>
        g.slots.forEach((s) => {
          const a = s.animais[0];
          todos.push({ nome: a.nome, local: s.nome, proprietario: a.proprietario || "", pend: a.tem_pendente, valor: a.total_mes, semLocal: false });
        }),
      );
      dados.semLocal?.forEach((a) => todos.push({ nome: a.nome, local: "", proprietario: a.proprietario || "", pend: false, valor: 0, semLocal: true }));

      if (!todos.length) {
        gridEl.innerHTML = `<div style="padding:12px 14px;color:var(--texto-suave);font-size:0.8rem;">Nenhum animal cadastrado.</div>`;
        return;
      }

      gridEl.innerHTML = todos.map((a, i) => {
        const avBg = a.semLocal ? "rgba(196,154,74,0.18)" : "#3D7A5E";
        const avClr = a.semLocal ? "#8B5230" : "white";
        const localTxt = a.semLocal ? "Sem local" : a.local;
        const localClr = a.semLocal ? "#C49A4A" : "var(--texto-suave)";
        const valF = a.valor > 0 ? a.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
        const badgeBg = a.pend ? "rgba(168,50,50,0.09)" : "rgba(61,122,94,0.09)";
        const badgeClr = a.pend ? "#7B1A1A" : "#1B5E20";
        const badgeTxt = a.pend && valF ? valF : a.pend ? "Pendente" : "Em dia";
        const borda = i > 0 ? "border-top:0.5px solid var(--bege-borda);" : "";
        return `<div onclick="RanchoApp.mudarAba('cavalos')" style="${borda}display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;">
          <div style="width:32px;height:32px;border-radius:9px;background:${avBg};display:flex;align-items:center;justify-content:center;color:${avClr};font-size:12px;font-weight:600;flex-shrink:0;">${a.nome.charAt(0).toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.nome}</div>
            <div style="font-size:0.72rem;color:${localClr};margin-top:1px;">${localTxt}${a.proprietario ? ` · ${a.proprietario}` : ""}</div>
          </div>
          ${!a.semLocal ? `<span style="background:${badgeBg};color:${badgeClr};border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;white-space:nowrap;flex-shrink:0;">${badgeTxt}</span>` : ""}
        </div>`;
      }).join("");
    } catch (e) {
      if (gridEl) gridEl.innerHTML = "";
    }
  },
});
