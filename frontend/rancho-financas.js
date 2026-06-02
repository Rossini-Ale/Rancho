// ── Finanças / Cobranças / Mensalidades / Custos / Config ─────
Object.assign(RanchoApp, {
  async carregarFinancas() {
    await Promise.all([this.carregarCobrancas(), this.carregarDespesasRancho()]);
  },

  async carregarCobrancas() {
    const wrap = document.getElementById("listaCobrancas");
    if (!wrap) return;
    wrap.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;
    try {
      const dados = await ApiService.fetchData("/api/dashboard/cobrancas");
      if (!dados) return;

      const totalEl = document.getElementById("totalAtraso");
      const qtdEl = document.getElementById("qtdAtrasados");
      const recEl = document.getElementById("receitaMesCobrancas");
      const pctEl = document.getElementById("pctReceitaCobrancas");

      if (totalEl) totalEl.textContent = dados.totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (qtdEl) {
        const qtd = new Set([...dados.pendentes.map((p) => p.proprietario_id), ...dados.custosDiretos.map((c) => c.proprietario_id)]).size;
        qtdEl.textContent = `${qtd} cliente${qtd !== 1 ? "s" : ""}`;
        qtdEl.className = `kpi-trend ${qtd > 0 ? "dn" : "up"}`;
      }
      if (recEl) recEl.textContent = dados.receitaMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (pctEl && dados.pctReceita !== null) {
        pctEl.textContent = `${dados.pctReceita > 0 ? "+" : ""}${dados.pctReceita}% vs mês ant.`;
        pctEl.className = `kpi-trend ${dados.pctReceita >= 0 ? "up" : "dn"}`;
      }

      const todos = [
        ...dados.pendentes.map((p) => ({ ...p, tipo: "mensalidade" })),
        ...dados.custosDiretos.map((c) => ({ ...c, tipo: "direto", cavalo: null })),
      ].sort((a, b) => b.dias_atraso - a.dias_atraso);
      this._dadosCobrancas = todos;
      this._renderCobrancas(todos, wrap);
    } catch (e) {}
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
    const nomesMeses = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    wrap.innerHTML = todos.map((item) => {
      const diasCor = item.dias_atraso > 30 ? "var(--vermelho)" : item.dias_atraso > 7 ? "var(--dourado)" : "var(--texto-suave)";
      const diasBg = item.dias_atraso > 30 ? "rgba(168,50,50,0.09)" : item.dias_atraso > 7 ? "rgba(196,154,74,0.12)" : "rgba(138,104,64,0.08)";
      const borderClr = item.dias_atraso > 30 ? "var(--vermelho)" : item.dias_atraso > 7 ? "var(--dourado)" : "var(--bege-borda)";
      const valF = item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const descricao = item.tipo === "mensalidade" ? `${item.cavalo} · ${item.itens || "Mensalidade"}` : item.descricao;
      const periodo = item.tipo === "mensalidade" ? `${nomesMeses[item.mes]}/${item.ano}` : new Date(item.data_despesa).toLocaleDateString("pt-BR");
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
          ${item.telefone ? `
          <button onclick="RanchoApp.cobrarWhatsApp('${item.proprietario}','${item.telefone}','${valF}','${descricao}','${periodo}')"
            style="margin-top:10px;background:#25D366;color:white;border:none;border-radius:10px;padding:7px 14px;font-size:0.78rem;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'DM Sans',sans-serif;">
            <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i> Cobrar via WhatsApp
          </button>` : ""}
        </div>`;
    }).join("");
  },

  filtrarFinancas() {
    const busca = (document.getElementById("buscaFinancas")?.value || "").toLowerCase().trim();
    const ordem = document.getElementById("ordenarFinancas")?.value || "nome";
    const lista = document.getElementById("listaCobrancas");
    if (!lista || !this._dadosCobrancas) return;
    let itens = [...this._dadosCobrancas];
    if (busca) itens = itens.filter((i) => i.nome?.toLowerCase().includes(busca));
    itens.sort((a, b) => {
      if (ordem === "valor") return (b.total_pendente || 0) - (a.total_pendente || 0);
      if (ordem === "status") return (b.tem_pendencia ? 1 : 0) - (a.tem_pendencia ? 1 : 0);
      return a.nome.localeCompare(b.nome);
    });
    this._renderCobrancas(itens, lista);
  },

  // ── Despesas do Rancho ──
  async carregarDespesasRancho() {
    const mes = this.dataFiltroRancho.getMonth() + 1;
    const ano = this.dataFiltroRancho.getFullYear();
    const lista = document.getElementById("listaDespesasCards");
    if (!lista) return;
    lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;
    try {
      const dados = await ApiService.fetchData(`/api/gestao/custos/rancho?mes=${mes}&ano=${ano}`);
      this._dadosDespesas = dados?.custos || [];
      this.atualizarLabelMesRancho();
      this._atualizarChipsDespesas(this._dadosDespesas);
      this._renderDespesas();
    } catch (e) {
      lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);">Erro ao carregar.</div>`;
    }
  },

  _atualizarChipsDespesas(custos) {
    const wrap = document.getElementById("chipsCategoriaRancho");
    if (!wrap) return;
    const cats = [...new Set(custos.map((c) => c.categoria).filter(Boolean))].sort();
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
    const icones = { Alimentação:"fa-wheat-awn", Manutenção:"fa-hammer", Funcionários:"fa-user-clock", Energia:"fa-bolt", Combustível:"fa-gas-pump" };
    let itens = [...(this._dadosDespesas || [])];
    if (this.categoriaFiltroRancho) itens = itens.filter((c) => c.categoria === this.categoriaFiltroRancho);

    const grafico = document.getElementById("areaGraficoRancho");
    if (grafico) {
      grafico.style.display = itens.length ? "block" : "none";
      if (itens.length) this.renderGraficoRancho(itens);
    }

    const total = itens.reduce((s, c) => s + parseFloat(c.valor), 0);
    const totalEl = document.getElementById("totalRanchoMesDisplay");
    if (totalEl) totalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    if (!itens.length) {
      lista.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;">
          <div style="font-size:2.5rem;color:var(--bege-borda);margin-bottom:8px;"><i class="fa-solid fa-clipboard-check"></i></div>
          <p style="color:var(--verde);font-family:'Lora',serif;font-weight:600;margin:0;">Tudo tranquilo!</p>
          <small style="color:var(--texto-suave);">Nenhuma despesa ${this.categoriaFiltroRancho ? "nesta categoria" : "lançada"}.</small>
        </div>`;
      return;
    }

    lista.innerHTML = itens.sort((a, b) => parseFloat(b.valor) - parseFloat(a.valor)).map((c) => {
      const valF = parseFloat(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const cat = c.categoria || "Geral";
      const cor = cores[cat] || { bg: "rgba(138,104,64,0.1)", cor: "var(--texto-suave)" };
      const ico = icones[cat] || "fa-tag";
      const data = new Date(c.data_despesa);
      const dataF = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
    }).join("");
  },

  filtrarCategoriaRancho(cat, el) {
    this.vibrar(10);
    this.categoriaFiltroRancho = cat;
    document.querySelectorAll("#chipsCategoriaRancho .chip").forEach((c) => c.classList.remove("active"));
    if (el) el.classList.add("active");
    this._renderDespesas();
  },

  renderGraficoRancho(custos) {
    const ctx = document.getElementById("graficoRancho");
    if (!ctx) return;
    const d = {};
    custos.forEach((c) => { const cat = c.categoria || "Outros"; d[cat] = (d[cat] || 0) + parseFloat(c.valor); });
    if (this.chartRancho) this.chartRancho.destroy();
    this.chartRancho = new Chart(ctx, {
      type: "doughnut",
      data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ["#3D1E0A","#8B5230","#C49A4A","#3D7A5E","#7A52A0","#A83232"], borderWidth: 1, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { boxWidth: 10, font: { size: 10, family: "'DM Sans',sans-serif" }, color: "#8A6840" } } }, layout: { padding: 8 } },
    });
  },

  mudarMesRancho(d) {
    this.vibrar(20);
    this.dataFiltroRancho.setMonth(this.dataFiltroRancho.getMonth() + d);
    this.carregarDespesasRancho();
  },

  atualizarLabelMesRancho() {
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const d = this.dataFiltroRancho;
    const label = document.getElementById("labelMesAnoRancho");
    if (label) label.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    const ant = new Date(d); ant.setMonth(ant.getMonth() - 1);
    const prox = new Date(d); prox.setMonth(prox.getMonth() + 1);
    const lAnt = document.getElementById("labelMesAnterior");
    if (lAnt) lAnt.textContent = meses[ant.getMonth()];
    const lProx = document.getElementById("labelMesProximo");
    if (lProx) lProx.textContent = meses[prox.getMonth()];
  },

  async salvarCustoRancho(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, '<i class="fa-solid fa-plus"></i>');
    let cat = document.getElementById("ranchoCat").value.trim();
    if (cat) cat = cat.charAt(0).toUpperCase() + cat.slice(1);
    else cat = "Geral";
    const body = {
      proprietario_id: null, cavalo_id: null,
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
      } catch (e) { this.mostrarNotificacao("Erro", "erro"); }
    });
  },

  // ── Custos por Animal ──
  async abrirFinanceiro(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("finCavaloId").value = cavaloId;
    document.getElementById("tituloModalFin").textContent = `Custos: ${nomeCavalo}`;
    document.getElementById("formCusto").reset();
    document.getElementById("custoIdEdit").value = "";
    document.getElementById("btnSalvarCusto").innerHTML = '<i class="fa-solid fa-plus"></i>';
    document.getElementById("btnSalvarCusto").classList.replace("btn-warning", "btn-success");
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
    document.getElementById("custoValor").value = parseFloat(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
    this.setLoading(btn, true, isEdit ? '<i class="fa-solid fa-rotate"></i>' : '<i class="fa-solid fa-plus"></i>');
    const cavaloId = document.getElementById("finCavaloId").value;
    const cat = document.getElementById("custoCat").value;
    let descricao = document.getElementById("custoDesc").value;
    if (!descricao?.trim()) descricao = cat;
    const body = {
      cavalo_id: cavaloId, proprietario_id: null,
      descricao, categoria: cat,
      valor: this.limparMoeda(document.getElementById("custoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
    };
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const cav = cavalos.find((c) => c.id == cavaloId);
      if (cav) body.proprietario_id = cav.proprietario_id;
      if (isEdit) { await ApiService.putData(`/api/gestao/custos/${custoId}`, body); this.mostrarNotificacao("Atualizado!"); }
      else { await ApiService.postData("/api/gestao/custos", body); this.mostrarNotificacao("Adicionado!"); }
      document.getElementById("formCusto").reset();
      document.getElementById("custoIdEdit").value = "";
      document.getElementById("btnSalvarCusto").classList.replace("btn-warning", "btn-success");
      document.getElementById("btnSalvarCusto").innerHTML = '<i class="fa-solid fa-plus"></i>';
      this.carregarListaCustos(cavaloId);
      this.carregarTabelaCavalos();
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, document.getElementById("custoIdEdit").value ? '<i class="fa-solid fa-rotate"></i>' : '<i class="fa-solid fa-plus"></i>');
    }
  },

  async carregarListaCustos(cavaloId) {
    const mes = this.dataFiltro.getMonth() + 1, ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(`/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`);
    const tbody = document.getElementById("tabelaCustosBody");
    tbody.innerHTML = "";
    this.renderGraficoFin(dados?.custos || []);
    if (dados?.custos?.length) {
      dados.custos.forEach((c) => {
        const dia = new Date(c.data_despesa).getDate();
        const mesNome = new Date(c.data_despesa).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
        const valF = parseFloat(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      document.getElementById("totalGastoModal").textContent = parseFloat(dados.total_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } else {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-5">Nenhum custo neste mês.</td></tr>';
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
      } catch (err) { this.mostrarNotificacao("Erro", "erro"); }
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
    if (el) el.textContent = this.dataFiltro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
  },

  renderGraficoFin(custos) {
    const ctx = document.getElementById("graficoFinanceiro"), area = document.getElementById("areaGrafico");
    if (!custos?.length) { if (area) area.style.display = "none"; return; }
    if (area) area.style.display = "block";
    const d = {};
    custos.forEach((c) => { const cat = c.categoria || "Outros"; d[cat] = (d[cat] || 0) + parseFloat(c.valor); });
    if (this.chartFinanceiro) this.chartFinanceiro.destroy();
    this.chartFinanceiro = new Chart(ctx, {
      type: "doughnut",
      data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ["#3D1E0A","#8B5230","#C49A4A","#3D7A5E","#7A52A0","#A83232"], borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { boxWidth: 10, font: { size: 10 }, color: "#8A6840" } } } },
    });
  },

  // ── Mensalidades ──
  async abrirMensalidade(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("mensalidadeCavaloId").value = cavaloId;
    document.getElementById("tituloModalMensalidade").textContent = `Mensalidade: ${nomeCavalo}`;
    document.getElementById("formMensalidade").reset();
    document.getElementById("checkBaia").checked = true;
    document.getElementById("checkAlimentacao").checked = true;
    document.getElementById("checkPiquete").checked = false;
    document.getElementById("checkTreino").checked = false;
    const campoData = document.getElementById("mensalidadeData");
    if (campoData) {
      campoData.closest(".col-6")?.style && (campoData.closest(".col-6").style.display = "none");
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
    const itens = ["checkBaia","checkPiquete","checkTreino","checkAlimentacao"]
      .filter((id) => document.getElementById(id)?.checked)
      .map((id) => document.getElementById(id).nextElementSibling.textContent.trim());
    const body = {
      cavalo_id: document.getElementById("mensalidadeCavaloId").value,
      mes: document.getElementById("mensalidadeMes").value,
      ano: document.getElementById("mensalidadeAno").value,
      valor: this.limparMoeda(document.getElementById("mensalidadeValor").value),
      itens: itens.join(", "),
    };
    try {
      await ApiService.postData("/api/gestao/mensalidades", body);
      this.mostrarNotificacao("Mensalidade adicionada!");
      this.carregarMensalidades(body.cavalo_id);
    } catch (err) {
      if (err.message?.includes("409")) this.mostrarNotificacao("Já existe mensalidade neste mês.", "erro");
      else this.mostrarNotificacao("Erro ao salvar", "erro");
    } finally {
      this.setLoading(btn, false, '<i class="fa-solid fa-plus me-2"></i> Adicionar à Fatura');
    }
  },

  async carregarMensalidades(cavaloId) {
    const lista = await ApiService.fetchData(`/api/gestao/mensalidades/${cavaloId}`);
    const tbody = document.getElementById("tabelaMensalidadeBody");
    tbody.innerHTML = "";
    const meses = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    if (!lista?.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-4" style="font-size:0.82rem;">Nenhuma mensalidade lançada.</td></tr>';
      return;
    }
    lista.forEach((m) => {
      const valF = parseFloat(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const badge = m.pago
        ? '<span class="badge-status badge-pago"><i class="fa-solid fa-check"></i> Pago</span>'
        : '<span class="badge-status badge-pendente"><i class="fa-solid fa-clock"></i> Pendente</span>';
      const tr = document.createElement("tr");
      tr.style.borderBottom = "0.5px solid var(--bege-borda)";
      tr.id = `mens-row-${m.id}`;
      tr.innerHTML = `
        <td style="padding:10px 12px;">
          <div style="font-family:'Lora',serif;font-weight:600;color:var(--texto-titulo);">${meses[m.mes]} / ${m.ano}</div>
          ${m.itens ? `<div style="font-size:0.72rem;color:var(--texto-suave);margin-top:2px;">${m.itens}</div>` : ""}
          <div style="margin-top:5px;">${badge}</div>
        </td>
        <td style="padding:10px 12px;text-align:right;">
          <div id="mens-view-${m.id}">
            <div style="font-weight:600;color:var(--texto-suave);margin-bottom:6px;">${valF}</div>
            <div style="display:flex;gap:5px;justify-content:flex-end;">
              <button class="btn-action icon-brown" style="width:30px;height:30px;" onclick="RanchoApp.editarMensalidade(${m.id},${cavaloId},${m.valor})"><i class="fa-solid fa-pen" style="font-size:0.7rem;"></i></button>
              <button class="btn-action icon-red" style="width:30px;height:30px;" onclick="RanchoApp.excluirMensalidade(${m.id},${cavaloId})"><i class="fa-solid fa-trash" style="font-size:0.7rem;"></i></button>
            </div>
          </div>
          <div id="mens-edit-${m.id}" style="display:none;">
            <input type="text" inputmode="decimal" id="mens-input-${m.id}" value="${parseFloat(m.valor).toFixed(2).replace(".", ",")}"
              style="width:90px;border:0.5px solid var(--marrom-claro);border-radius:9px;padding:5px 8px;font-size:0.82rem;text-align:right;background:var(--bege-fundo);margin-bottom:6px;"/>
            <div style="display:flex;gap:5px;justify-content:flex-end;">
              <button class="btn-action icon-verde" style="width:30px;height:30px;" onclick="RanchoApp.salvarEdicaoMensalidade(${m.id},${cavaloId})"><i class="fa-solid fa-check" style="font-size:0.7rem;"></i></button>
              <button class="btn-action icon-brown" style="width:30px;height:30px;" onclick="RanchoApp.cancelarEdicaoMensalidade(${m.id})"><i class="fa-solid fa-xmark" style="font-size:0.7rem;"></i></button>
            </div>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  },

  editarMensalidade(id) {
    document.querySelectorAll("[id^='mens-edit-']").forEach((el) => (el.style.display = "none"));
    document.querySelectorAll("[id^='mens-view-']").forEach((el) => (el.style.display = "block"));
    const view = document.getElementById(`mens-view-${id}`);
    const edit = document.getElementById(`mens-edit-${id}`);
    if (!view || !edit) return;
    view.style.display = "none";
    edit.style.display = "block";
    const input = document.getElementById(`mens-input-${id}`);
    if (input) { input.focus(); input.select(); }
  },

  cancelarEdicaoMensalidade(id) {
    const view = document.getElementById(`mens-view-${id}`);
    const edit = document.getElementById(`mens-edit-${id}`);
    if (view) view.style.display = "block";
    if (edit) edit.style.display = "none";
  },

  async salvarEdicaoMensalidade(id, cavaloId) {
    const input = document.getElementById(`mens-input-${id}`);
    if (!input) return;
    const valor = parseFloat(input.value.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { this.mostrarNotificacao("Valor inválido.", "erro"); return; }
    try {
      await ApiService.putData(`/api/gestao/mensalidades/${id}`, { valor });
      this.mostrarNotificacao("Mensalidade atualizada!");
      this.carregarMensalidades(cavaloId);
    } catch (e) { this.mostrarNotificacao("Erro ao salvar.", "erro"); }
  },

  excluirMensalidade(id, cavaloId) {
    this.abrirConfirmacao("Excluir", "Remover cobrança?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/mensalidades/${id}`);
        this.carregarMensalidades(cavaloId);
        this.mostrarNotificacao("Removido.");
      } catch (e) { this.mostrarNotificacao("Erro", "erro"); }
    });
  },

  // ── Relatório / Resumo ──
  gerarRelatorio() {
    const mes = parseInt(document.getElementById("relatorioMes")?.value) || new Date().getMonth() + 1;
    const ano = parseInt(document.getElementById("relatorioAno")?.value) || new Date().getFullYear();
    Relatorio.gerar(mes, ano);
  },

  async compartilharResumoMes() {
    this.vibrar();
    this.mostrarNotificacao("Gerando resumo...");
    const mes = parseInt(document.getElementById("relatorioMes")?.value) || new Date().getMonth() + 1;
    const ano = parseInt(document.getElementById("relatorioAno")?.value) || new Date().getFullYear();
    const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const nomeMes = nomesMeses[mes - 1];
    try {
      const [kpis, ocup] = await Promise.all([
        ApiService.fetchData(`/api/dashboard/relatorio?mes=${mes}&ano=${ano}`),
        ApiService.fetchData("/api/dashboard/ocupacao"),
      ]);
      if (!kpis) return;
      const receita = kpis.kpis.receita.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const despesas = kpis.kpis.despesas.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const lucro = kpis.kpis.lucro.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const atraso = kpis.kpis.pendencias.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const pctRec = kpis.kpis.receita.pct !== null ? `${kpis.kpis.receita.pct > 0 ? "↑" : "↓"} ${Math.abs(kpis.kpis.receita.pct)}% vs mês ant.` : "Primeiro mês";
      const pctDesp = kpis.kpis.despesas.pct !== null ? `${kpis.kpis.despesas.pct > 0 ? "↑" : "↓"} ${Math.abs(kpis.kpis.despesas.pct)}% vs mês ant.` : "Primeiro mês";
      const totalAnim = ocup?.stats?.totalAnimais || 0;
      const ocup7 = ocup?.stats?.totalOcupados || 0;
      const todos = [];
      ocup?.grupos?.forEach((g) => g.slots.forEach((s) => todos.push({ nome: s.animais[0].nome, pend: s.animais[0].tem_pendente })));
      ocup?.semLocal?.forEach((a) => todos.push({ nome: a.nome, pend: a.tem_pendente }));
      const animGrid = todos.map((a) => {
        const bg = a.pend ? "rgba(224,96,96,0.15)" : "rgba(232,201,122,0.1)";
        const clr = a.pend ? "#E06060" : "#E8C97A";
        return `<div style="width:26px;height:26px;border-radius:7px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:${clr};">${a.nome.charAt(0).toUpperCase()}</div>`;
      }).join("");
      const dataGeracao = new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const card = document.createElement("div");
      card.style.cssText = "position:fixed;left:-9999px;top:0;width:340px;font-family:'DM Sans',sans-serif;background:#2C1206;border-radius:18px;overflow:hidden;";
      card.innerHTML = `
        <div style="background:#3D1E0A;padding:14px 18px 12px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:9px;background:rgba(232,201,122,0.15);display:flex;align-items:center;justify-content:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="#E8C97A"><path d="M19 5c-1.5 0-2.8.8-3.5 2H12c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-2.5c1.2-.7 2-2 2-3.5C21 6.1 20.1 5 19 5z"/></svg></div><span style="font-size:13px;color:#E8C97A;font-weight:500;">${this.nomeRancho || "HF Controll"}</span></div>
          <span style="font-size:10px;color:rgba(232,201,122,0.45);">${nomeMes} ${ano}</span>
        </div>
        <div style="padding:16px 18px 12px;border-bottom:0.5px solid rgba(255,255,255,0.07);">
          <div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.6px;">Lucro líquido</div>
          <div style="font-size:2.2rem;color:#E8C97A;margin-top:4px;font-weight:500;">${lucro}</div>
          <div style="font-size:10px;color:rgba(232,201,122,0.4);margin-top:3px;">Receita ${receita} · Despesas ${despesas}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,0.07);">
          <div style="background:#2C1206;padding:12px 14px;"><div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Receita</div><div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${receita}</div><div style="font-size:9px;color:rgba(95,191,144,0.8);margin-top:2px;">${pctRec}</div></div>
          <div style="background:#2C1206;padding:12px 14px;"><div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Despesas</div><div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${despesas}</div><div style="font-size:9px;color:rgba(224,96,96,0.8);margin-top:2px;">${pctDesp}</div></div>
          <div style="background:#2C1206;padding:12px 14px;"><div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Em atraso</div><div style="font-size:15px;font-weight:500;color:${kpis.kpis.pendencias.total > 0 ? "#E06060" : "#E8C97A"};margin-top:3px;">${atraso}</div><div style="font-size:9px;color:rgba(232,201,122,0.35);margin-top:2px;">${kpis.kpis.pendencias.clientes} cliente${kpis.kpis.pendencias.clientes !== 1 ? "s" : ""}</div></div>
          <div style="background:#2C1206;padding:12px 14px;"><div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Animais</div><div style="font-size:15px;font-weight:500;color:#E8C97A;margin-top:3px;">${totalAnim}</div><div style="font-size:9px;color:rgba(232,201,122,0.35);margin-top:2px;">${ocup7} com local</div></div>
        </div>
        ${todos.length > 0 ? `<div style="padding:12px 18px 14px;"><div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Animais no rancho</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${animGrid}</div></div>` : ""}
        <div style="padding:10px 18px 14px;display:flex;justify-content:space-between;align-items:center;border-top:0.5px solid rgba(255,255,255,0.06);">
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">Gerado em ${dataGeracao}</span>
          <span style="font-size:9px;color:rgba(232,201,122,0.25);">${this.nomeRancho || "HF Controll"}</span>
        </div>`;
      document.body.appendChild(card);
      if (!window.html2canvas) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(s);
        await new Promise((r) => (s.onload = r));
      }
      const canvas = await window.html2canvas(card, { backgroundColor: "#2C1206", scale: 2, useCORS: true, logging: false });
      document.body.removeChild(card);
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `Resumo_${nomeMes}_${ano}.png`, { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], text: `Resumo do rancho — ${nomeMes} ${ano} 🐴` }); return; } catch (e) {}
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = file.name; link.click();
        URL.revokeObjectURL(url);
        this.mostrarNotificacao("Imagem salva!");
      }, "image/png");
    } catch (e) {
      this.mostrarNotificacao("Erro ao gerar resumo.", "erro");
    }
  },

  // ── PDF Animal ──
  async gerarPDF() {
    if (!window.jspdf) { this.mostrarNotificacao("Carregando PDF...", "erro"); return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF();
    const cavaloId = document.getElementById("finCavaloId").value;
    const nomeCavalo = document.getElementById("tituloModalFin").textContent.replace("Custos: ", "");
    const periodo = document.getElementById("labelMesAno").textContent;
    const mes = this.dataFiltro.getMonth() + 1, ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(`/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`);
    if (!dados?.custos?.length) { this.mostrarNotificacao("Sem custos.", "erro"); return; }
    doc.setTextColor(61, 30, 10); doc.setFontSize(18);
    doc.text(document.getElementById("brandName").textContent, 14, 20);
    doc.setTextColor(60, 60, 60); doc.setFontSize(12);
    doc.text(`Extrato de Despesas`, 14, 28); doc.setFontSize(10);
    doc.text(`Animal: ${nomeCavalo}`, 14, 35);
    doc.text(`Período: ${periodo}`, 14, 40);
    doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 45);
    const rows = dados.custos.map((c) => [new Date(c.data_despesa).toLocaleDateString("pt-BR"), c.descricao, c.categoria, parseFloat(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]);
    doc.autoTable({ startY: 50, head: [["Data", "Descrição", "Categoria", "Valor"]], body: rows, theme: "grid", headStyles: { fillColor: [61, 30, 10], textColor: 255, fontStyle: "bold" }, columnStyles: { 0: { cellWidth: 25 }, 3: { halign: "right", fontStyle: "bold" } } });
    doc.setFontSize(14); doc.setTextColor(168, 50, 50);
    doc.text(parseFloat(dados.total_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), 195, doc.lastAutoTable.finalY + 10, { align: "right" });
    doc.save(`${nomeCavalo.trim()}_${periodo.replace(" ", "_")}.pdf`);
  },

  // ── Busca Global ──
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
      if (val.length < 2) { if (result) result.style.display = "none"; return; }
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
      const dados = await ApiService.fetchData(`/api/dashboard/busca?q=${encodeURIComponent(termo)}`);
      const total = (dados.cavalos?.length || 0) + (dados.proprietarios?.length || 0) + (dados.custos?.length || 0);
      if (!total) { result.innerHTML = `<div style="padding:12px;color:var(--texto-suave);font-size:0.82rem;">Nenhum resultado para "<b>${termo}</b>"</div>`; return; }
      let html = `<div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:16px;overflow:hidden;margin-bottom:10px;">`;
      if (dados.cavalos?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Animais</div>`;
        html += dados.cavalos.map((c) => `
          <div onclick="RanchoApp.abrirModalEditar(${c.id},'${c.nome.replace(/'/g, "\\'")}','${(c.lugar || "").replace(/'/g, "\\'")}','${c.proprietario_id || ""}','')"
            style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;gap:10px;cursor:pointer;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--marrom-claro),var(--marrom-escuro));display:flex;align-items:center;justify-content:center;color:var(--dourado-claro);font-size:12px;font-weight:600;flex-shrink:0;">${c.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;"><div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${c.nome}</div><div style="font-size:0.72rem;color:var(--texto-suave);">${c.lugar || "Sem local"} · ${c.nome_proprietario || "Sem proprietário"}</div></div>
            ${c.total_mes > 0 ? `<span style="background:rgba(168,50,50,0.08);color:var(--vermelho);border-radius:8px;padding:2px 8px;font-size:0.72rem;font-weight:600;">${c.total_mes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>` : ""}
          </div>`).join("");
      }
      if (dados.proprietarios?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;${dados.cavalos?.length ? "border-top:0.5px solid var(--bege-borda);" : ""}">Clientes</div>`;
        html += dados.proprietarios.map((p) => `
          <div onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${p.nome}','${p.telefone || ""}')"
            style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;gap:10px;cursor:pointer;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6B7280,#374151);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;flex-shrink:0;">${p.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;"><div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${p.nome}</div><div style="font-size:0.72rem;color:var(--texto-suave);">${p.telefone || "Sem telefone"}</div></div>
            <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;color:var(--texto-suave);"></i>
          </div>`).join("");
      }
      if (dados.custos?.length) {
        html += `<div style="padding:8px 14px 4px;font-size:0.7rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;border-top:0.5px solid var(--bege-borda);">Custos recentes</div>`;
        html += dados.custos.map((c) => {
          const valF = c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const ref = c.cavalo || c.proprietario || "Rancho";
          return `<div style="padding:10px 14px;border-top:0.5px solid var(--bege-borda);display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="min-width:0;"><div style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.descricao}</div><div style="font-size:0.72rem;color:var(--texto-suave);">${ref} · ${new Date(c.data_despesa).toLocaleDateString("pt-BR")}</div></div>
            <div style="text-align:right;flex-shrink:0;"><div style="font-size:0.85rem;font-weight:600;color:var(--vermelho);">${valF}</div><div style="font-size:0.7rem;color:${c.pago ? "var(--verde)" : "var(--vermelho)"};">${c.pago ? "Pago" : "Pendente"}</div></div>
          </div>`;
        }).join("");
      }
      html += `</div>`;
      result.innerHTML = html;
    } catch (e) {
      result.innerHTML = `<div style="padding:12px;color:var(--texto-suave);font-size:0.82rem;">Erro ao buscar.</div>`;
    }
  },

  // ── Config ──
  abrirModalConfig() { this.vibrar(); this.bsModalConfig.show(); },

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
});
