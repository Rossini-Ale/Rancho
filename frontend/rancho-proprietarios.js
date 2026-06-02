// ── Proprietários / Faturas / WhatsApp / Lotes ────────────────
Object.assign(RanchoApp, {
  async carregarTabelaProprietarios() {
    const wrap = document.getElementById("listaProprietariosMainBody");
    if (!wrap) return;
    if (!this._cacheGet("proprietarios")) wrap.innerHTML = `<div style="padding:0 14px;">${this.skeletonRows(3)}</div>`;
    try {
      const props = this._cacheGet("proprietarios") ?? await ApiService.fetchData("/api/gestao/proprietarios").then((r) => { this._cacheSet("proprietarios", r); return r; });
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
        txtAnimais: p.total_animais == 1 ? "1 animal" : `${p.total_animais || 0} animais`,
        txtValor: parseFloat(p.total_divida || 0) > 0
          ? parseFloat(p.total_divida).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "Pago",
      }));

      lista.sort((a, b) => {
        if (a.temPendencia !== b.temPendencia) return b.temPendencia ? 1 : -1;
        return a.nome.localeCompare(b.nome);
      });

      lista.forEach((p) => {
        const avBg = p.temPendencia ? "linear-gradient(135deg,#7B1A1A,#A83232)" : "linear-gradient(135deg,#1B5E20,#3D7A5E)";
        const badgeBg = p.temPendencia ? "rgba(168,50,50,0.09)" : "rgba(61,122,94,0.09)";
        const badgeClr = p.temPendencia ? "#7B1A1A" : "#1B5E20";
        const nomeS = p.nome.replace(/'/g, "\\'");
        const telS = (p.telefone || "").replace(/'/g, "\\'");

        const el = document.createElement("div");
        el.className = "animal-card";
        el.style.padding = "0";
        el.style.overflow = "hidden";
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:13px 14px 11px;cursor:pointer;" onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${nomeS}','${telS}')">
            <div style="width:42px;height:42px;border-radius:13px;background:${avBg};display:flex;align-items:center;justify-content:center;color:white;font-size:1rem;font-weight:600;flex-shrink:0;">${p.nome.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Lora',serif;font-size:0.95rem;font-weight:600;color:var(--texto-titulo);">${p.nome}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:0.72rem;color:var(--marrom-claro);font-weight:600;"><i class="fa-solid fa-horse-head" style="font-size:0.62rem;"></i> ${p.txtAnimais}</span>
                ${p.telefone ? `<span style="font-size:0.7rem;color:var(--texto-suave);"><i class="fa-solid fa-phone" style="font-size:0.62rem;"></i> ${p.telefone}</span>` : ""}
                ${p.email ? `<span style="font-size:0.7rem;color:var(--texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;"><i class="fa-solid fa-envelope" style="font-size:0.6rem;"></i> ${p.email}</span>` : ""}
              </div>
              ${p.observacoes ? `<div style="font-size:0.68rem;color:var(--texto-suave);font-style:italic;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${p.observacoes}"</div>` : ""}
            </div>
            <span style="background:${badgeBg};color:${badgeClr};border-radius:9px;padding:4px 10px;font-size:0.78rem;font-weight:700;white-space:nowrap;flex-shrink:0;">${p.txtValor}</span>
          </div>
          ${p.temPendencia ? `
          <div style="padding:6px 12px;border-top:0.5px solid var(--bege-borda);">
            <button onclick="RanchoApp.receberRapido(${p.id},'${nomeS}','${telS}')"
              style="width:100%;background:rgba(61,122,94,0.08);border:0.5px solid rgba(61,122,94,0.25);border-radius:10px;padding:7px 12px;font-size:0.78rem;font-weight:600;color:#1B5E20;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              <i class="fa-solid fa-circle-check" style="font-size:0.85rem;"></i> Confirmar recebimento do mês atual
            </button>
          </div>` : ""}
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
            ${p.telefone ? `
            <button onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${nomeS}','${telS}')"
              style="flex:1;padding:9px 4px;font-size:0.75rem;font-weight:600;color:#1a8a3a;background:none;border:none;border-right:0.5px solid var(--bege-borda);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background 0.15s;"
              onmouseover="this.style.background='rgba(37,211,102,0.05)'" onmouseout="this.style.background='none'">
              <i class="fa-brands fa-whatsapp" style="font-size:0.85rem;"></i> WhatsApp
            </button>` : ""}
            <button onclick="RanchoApp.abrirModalGerenciarProprietarios(${p.id},'${nomeS}','${telS}')"
              style="flex:0 0 44px;padding:9px 4px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--texto-suave);transition:background 0.15s;"
              onmouseover="this.style.background='var(--bege-hover)'" onmouseout="this.style.background='none'">
              <i class="fa-solid fa-pen" style="font-size:0.75rem;"></i>
            </button>
          </div>`;
        wrap.appendChild(el);
      });
    } catch (e) {}
  },

  exportarClientesCSV() {
    const cached = this._cacheGet("proprietarios");
    if (!cached) { this.mostrarNotificacao("Carregue os clientes primeiro.", "erro"); return; }
    const cabecalho = ["Nome", "WhatsApp", "Email", "Animais", "Dívida Atual (R$)", "Observações"];
    const linhas = cached.map((p) => [
      p.nome,
      p.telefone || "",
      p.email || "",
      p.total_animais || 0,
      parseFloat(p.total_divida || 0).toFixed(2).replace(".", ","),
      p.observacoes || "",
    ]);
    this.exportarCSV(`Clientes_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`, cabecalho, linhas);
  },

  filtrarClientes() {
    const busca = (document.getElementById("buscaClientes")?.value || "").toLowerCase().trim();
    document.querySelectorAll("#listaProprietariosMainBody > div").forEach((el) => {
      el.style.display = el.textContent.toLowerCase().includes(busca) ? "" : "none";
    });
  },

  abrirModalGerenciarProprietarios(id = null, n = "", t = "") {
    this.vibrar();
    document.getElementById("formProprietario").reset();
    if (id) {
      const cached = this._cacheGet("proprietarios") || [];
      const prop = cached.find((p) => p.id == id);
      document.getElementById("propId").value = id;
      document.getElementById("propNome").value = n;
      document.getElementById("propTelefone").value = t;
      document.getElementById("propEmail").value = prop?.email || "";
      document.getElementById("propObs").value = prop?.observacoes || "";
      document.getElementById("btnExcluirProp").classList.remove("d-none");
    } else {
      document.getElementById("propId").value = "";
      document.getElementById("propEmail").value = "";
      document.getElementById("propObs").value = "";
      document.getElementById("btnExcluirProp").classList.add("d-none");
    }
    this.bsModalProp.show();
  },

  async salvarProprietario(e) {
    e.preventDefault();
    const b = e.submitter;
    this.setLoading(b, true, "Salvar");
    const id = document.getElementById("propId").value;
    const body = {
      nome: document.getElementById("propNome").value,
      telefone: document.getElementById("propTelefone").value,
      email: document.getElementById("propEmail").value.trim() || null,
      observacoes: document.getElementById("propObs").value.trim() || null,
    };
    try {
      if (id) await ApiService.putData(`/api/gestao/proprietarios/${id}`, body);
      else await ApiService.postData("/api/gestao/proprietarios", body);
      this._cacheClear("proprietarios", "kpis", "cobrancas", "alertas");
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
        this._cacheClear("proprietarios", "kpis", "cobrancas", "alertas");
        this.bsModalProp.hide();
        this.carregarTabelaProprietarios();
        this.carregarProprietariosSelect();
      });
  },

  receberRapido(propId, nome, tel) {
    this.vibrar();
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    this.abrirConfirmacao(
      "Confirmar recebimento",
      `Marcar fatura de ${nome} — ${nomesMeses[mes - 1]}/${ano} como paga?`,
      async () => {
        try {
          await ApiService.putData("/api/gestao/custos/baixar-mes", { proprietario_id: propId, mes, ano });
          this._cacheClear("proprietarios", "cobrancas", "kpis", "alertas");
          await this.carregarTabelaProprietarios();
          this.mostrarNotificacao("Pagamento confirmado!");
          if (tel && tel !== "Sem telefone") {
            const telLimpo = tel.replace(/\D/g, "");
            setTimeout(() => {
              this.abrirConfirmacao("Enviar confirmação?", `Avisar ${nome} via WhatsApp?`, () => {
                const msg = `Olá *${nome}*! ✅\n\nConfirmamos o recebimento de *${nomesMeses[mes - 1]}/${ano}*.\n\nObrigado pela pontualidade! 🤝\n\n${this.nomeRancho || "HF Controll"}`;
                window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, "_blank");
              });
            }, 400);
          }
        } catch (e) {
          this.mostrarNotificacao("Erro ao confirmar.", "erro");
        }
      }
    );
  },

  aplicarReajuste() {
    const pct = parseFloat(document.getElementById("loteReajuste").value) || 0;
    if (!pct) { this.mostrarNotificacao("Informe um percentual.", "erro"); return; }
    const fator = 1 + pct / 100;
    let count = 0;
    document.querySelectorAll(".lote-valor-individual").forEach((inp) => {
      const v = parseFloat(inp.value.replace(",", "."));
      if (!isNaN(v) && v > 0) {
        inp.value = (v * fator).toFixed(2).replace(".", ",");
        count++;
      }
    });
    if (!count) { this.mostrarNotificacao("Copie o mês anterior antes de reajustar.", "erro"); return; }
    this.mostrarNotificacao(`${pct > 0 ? "+" : ""}${pct}% aplicado em ${count} animal${count !== 1 ? "is" : ""}!`);
  },

  async abrirDetalhesProprietario(id, n, t) {
    this.vibrar();
    this.proprietarioAtualId = id;
    document.getElementById("tituloDetalhesProp").textContent = n;
    document.getElementById("subtituloDetalhesProp").textContent = t || "Sem telefone";
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
    if (el) el.textContent = this.dataFiltroProp.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
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

  async carregarFaturaProprietario(propId, nomeProp, telefoneProp) {
    const tbody = document.getElementById("listaCavalosPropBody");
    tbody.innerHTML = '<tr><td colspan="2" class="text-center p-4"><div class="spinner-border" style="color:var(--marrom-claro);" role="status"></div></td></tr>';
    try {
      const mes = this.dataFiltroProp.getMonth() + 1, ano = this.dataFiltroProp.getFullYear();
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meus = allCavalos.filter((c) => c.proprietario_id == propId);
      const pCavalos = meus.map(async (c) => {
        const d = await ApiService.fetchData(`/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`);
        return d.custos ? d.custos.map((i) => ({ tipo: "cavalo", nome: `${c.nome} — ${i.descricao}`, custo: parseFloat(i.valor), id: i.id, pago: i.pago })) : [];
      });
      const diretos = await ApiService.fetchData(`/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`);
      const iDiretos = diretos.map((c) => ({ tipo: "direto", nome: c.descricao, custo: parseFloat(c.valor), id: c.id, pago: c.pago }));
      const res = await Promise.all(pCavalos);
      const lista = [...res.flat(), ...iDiretos];
      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-5" style="font-size:0.82rem;"><i class="fa-regular fa-folder-open" style="font-size:2rem;display:block;margin-bottom:8px;color:var(--bege-borda);"></i>Fatura zerada.</td></tr>';
        document.getElementById("totalGeralProp").textContent = "R$ 0,00";
        document.getElementById("acoesFatura").classList.add("d-none");
        return;
      }
      document.getElementById("acoesFatura").classList.remove("d-none");
      let pendente = 0, html = "";
      lista.forEach((item) => {
        const valF = item.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        let acao = "";
        const ico = item.pago ? '<i class="fa-solid fa-check-circle text-success me-2"></i>' : '<i class="fa-regular fa-circle text-muted me-2"></i>';
        if (!item.pago) {
          pendente += item.custo;
          if (item.tipo === "direto") acao = `<button class="btn btn-sm text-danger ms-2 p-0" onclick="RanchoApp.excluirCustoDireto(${item.id})"><i class="fa-solid fa-times"></i></button>`;
        }
        html += `<tr style="border-bottom:0.5px solid var(--bege-borda);"><td style="padding:10px 14px;"><div class="${item.pago ? "text-success text-decoration-line-through opacity-75" : "fw-bold"}" style="color:${item.pago ? "" : "var(--texto-titulo)"};">${ico}${item.nome}</div></td><td style="padding:10px 14px;text-align:right;"><span class="${item.pago ? "text-success opacity-75" : "fw-bold"}">${valF}</span>${acao}</td></tr>`;
      });
      tbody.innerHTML = html;
      const btnB = document.getElementById("btnBaixarFatura"), btnZ = document.getElementById("btnZapCobranca");
      if (pendente > 0) {
        document.getElementById("totalGeralProp").innerHTML = `<span style="color:var(--vermelho);">${pendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>`;
        btnB.disabled = false;
        btnB.innerHTML = '<i class="fa-solid fa-check-circle me-2"></i> Confirmar Pagamento';
        btnB.className = "btn btn-primary py-3 rounded-4 fw-bold shadow-sm";
        btnB.onclick = () => this.baixarFaturaMes();
      } else {
        document.getElementById("totalGeralProp").innerHTML = '<span class="text-success"><i class="fa-solid fa-check-double me-2"></i>Pago</span>';
        btnB.disabled = false;
        btnB.className = "btn btn-outline-danger py-2 rounded-4 fw-bold";
        btnB.innerHTML = '<i class="fa-solid fa-rotate-left me-2"></i> Estornar pagamento';
        btnB.onclick = () => this.estornarFaturaMes();
      }
      const novoBtnZ = btnZ.cloneNode(true);
      btnZ.parentNode.replaceChild(novoBtnZ, btnZ);
      novoBtnZ.onclick = () => {
        const tx = pendente > 0 ? pendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "QUITADO";
        this.compartilharFaturaZap(propId, nomeProp, tx, telefoneProp.replace(/\D/g, ""));
      };
    } catch (err) {}
  },

  async baixarFaturaMes() {
    this.abrirConfirmacao("Confirmar pagamento", "Marcar fatura como paga?", async () => {
      const propId = this.proprietarioAtualId;
      const mes = this.dataFiltroProp.getMonth() + 1;
      const ano = this.dataFiltroProp.getFullYear();
      const nome = document.getElementById("tituloDetalhesProp").textContent;
      const tel = document.getElementById("subtituloDetalhesProp").textContent;

      await ApiService.putData("/api/gestao/custos/baixar-mes", { proprietario_id: propId, mes, ano });

      const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      const periodo = `${nomesMeses[mes - 1]} ${ano}`;

      this.carregarFaturaProprietario(propId, nome, tel);
      this.mostrarNotificacao("Pagamento confirmado!");

      if (tel && tel !== "Sem telefone") {
        const telLimpo = tel.replace(/\D/g, "");
        setTimeout(() => {
          this.abrirConfirmacao("Enviar confirmação?", `Enviar mensagem de confirmação para ${nome} via WhatsApp?`, () => {
            const msg = `Olá *${nome}*! ✅\n\nConfirmamos o recebimento do pagamento referente a *${periodo}*.\n\nObrigado pela pontualidade! 🤝\n\n${this.nomeRancho || "HF Controll"}`;
            window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, "_blank");
          });
        }, 400);
      }
    });
  },

  async estornarFaturaMes() {
    this.abrirConfirmacao("Estornar pagamento", "Tem certeza? Isso vai marcar a fatura como pendente novamente.", async () => {
      const propId = this.proprietarioAtualId;
      const mes = this.dataFiltroProp.getMonth() + 1;
      const ano = this.dataFiltroProp.getFullYear();
      const nome = document.getElementById("tituloDetalhesProp").textContent;
      const tel = document.getElementById("subtituloDetalhesProp").textContent;
      try {
        await ApiService.putData("/api/gestao/custos/estornar-mes", { proprietario_id: propId, mes, ano });
        this.carregarFaturaProprietario(propId, nome, tel);
        this.mostrarNotificacao("Pagamento estornado.");
      } catch (e) {
        this.mostrarNotificacao("Erro ao estornar.", "erro");
      }
    });
  },

  async compartilharFaturaZap(propId, nomeProp, totalTexto, telefone) {
    this.vibrar();
    this.mostrarNotificacao("Gerando card...");
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1;
    const ano = this.dataFiltroProp.getFullYear();
    const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    try {
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meus = allCavalos.filter((c) => c.proprietario_id == propId);
      const historico = await ApiService.fetchData(`/api/dashboard/historico-cliente/${propId}`);
      const pix = this.chavePixCache?.trim() || "";
      const itens = [];
      for (const c of meus) {
        const resumo = await ApiService.fetchData(`/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`);
        if (resumo?.mensalidade) itens.push({ nome: `${c.nome} — Mensalidade`, valor: parseFloat(resumo.mensalidade.valor), pago: resumo.mensalidade.pago == 1, inicial: c.nome.charAt(0).toUpperCase() });
        if (resumo?.custos) resumo.custos.filter((x) => !x.is_mensalidade).forEach((x) => itens.push({ nome: `${c.nome} — ${x.descricao}`, valor: parseFloat(x.valor), pago: x.pago == 1, inicial: c.nome.charAt(0).toUpperCase() }));
      }
      const diretos = await ApiService.fetchData(`/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`);
      if (diretos) diretos.forEach((x) => itens.push({ nome: x.descricao, valor: parseFloat(x.valor), pago: x.pago == 1, inicial: "•" }));

      const totalPendente = itens.filter((i) => !i.pago).reduce((s, i) => s + i.valor, 0);
      const totalGeral = itens.reduce((s, i) => s + i.valor, 0);
      const temPendente = totalPendente > 0;
      const hist6 = historico?.historico?.filter((h) => h.totalMes > 0).slice(-6) || [];
      const dataGeracao = new Date().toLocaleDateString("pt-BR") + " · " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const itenHtml = itens.map((i) => {
        const valF = i.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const cor = i.pago ? "#5FBF90" : "#E06060";
        const bgAv = i.pago ? "rgba(95,191,144,0.2)" : "rgba(224,96,96,0.15)";
        const badge = i.pago ? "Pago" : "Pendente";
        const bgBadge = i.pago ? "rgba(95,191,144,0.12)" : "rgba(224,96,96,0.12)";
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.05);">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <div style="width:26px;height:26px;border-radius:50%;background:${bgAv};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:${cor};flex-shrink:0;">${i.inicial}</div>
            <div style="min-width:0;"><div style="font-size:11px;color:#E8C97A;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.nome}</div></div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px;">
            <div style="font-size:11px;font-weight:500;color:${cor};">${valF}</div>
            <div style="font-size:8px;padding:1px 6px;border-radius:4px;background:${bgBadge};color:${cor};margin-top:2px;">${badge}</div>
          </div>
        </div>`;
      }).join("");

      const histHtml = hist6.map((h) => {
        const bg = h.temPendente ? "rgba(224,96,96,0.12)" : "rgba(95,191,144,0.15)";
        const ico = h.temPendente
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="#E06060"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
          : `<svg width="10" height="10" viewBox="0 0 24 24" fill="#5FBF90"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        const lbl = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][h.mes - 1];
        return `<div style="text-align:center;"><div style="font-size:8px;color:rgba(232,201,122,0.35);margin-bottom:4px;">${lbl}</div><div style="width:100%;height:22px;border-radius:5px;background:${bg};display:flex;align-items:center;justify-content:center;">${ico}</div></div>`;
      }).join("");

      const card = document.createElement("div");
      card.style.cssText = "position:fixed;left:-9999px;top:0;width:340px;font-family:'DM Sans',sans-serif;background:#2C1206;border-radius:18px;overflow:hidden;";
      card.innerHTML = `
        <div style="background:#3D1E0A;padding:14px 18px 12px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:9px;background:rgba(232,201,122,0.15);display:flex;align-items:center;justify-content:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="#E8C97A"><path d="M19 5c-1.5 0-2.8.8-3.5 2H12c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-2.5c1.2-.7 2-2 2-3.5C21 6.1 20.1 5 19 5z"/></svg></div><span style="font-size:13px;color:#E8C97A;font-weight:500;">${this.nomeRancho || "HF Controll"}</span></div>
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
        <div style="padding:12px 18px 4px;"><div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Detalhamento</div>${itenHtml || `<div style="font-size:11px;color:rgba(232,201,122,0.3);padding:8px 0;">Nenhum item neste mês.</div>`}</div>
        ${hist6.length > 0 ? `<div style="padding:12px 18px 4px;"><div style="font-size:9px;color:rgba(232,201,122,0.35);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Histórico de pontualidade</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">${histHtml}</div></div>` : ""}
        ${pix ? `<div style="background:rgba(232,201,122,0.06);border:0.5px solid rgba(232,201,122,0.12);border-radius:12px;padding:10px 13px;margin:10px 18px;"><div style="font-size:9px;color:rgba(232,201,122,0.4);text-transform:uppercase;letter-spacing:0.5px;">Chave PIX</div><div style="font-size:12px;color:#E8C97A;font-weight:500;margin-top:3px;">${pix}</div></div>` : ""}
        <div style="padding:10px 18px 14px;display:flex;justify-content:space-between;align-items:center;border-top:0.5px solid rgba(255,255,255,0.06);margin-top:10px;">
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
        const tel = telefone.replace(/\D/g, "");
        const valF = totalPendente > 0 ? totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "QUITADO";
        const msg = `Olá *${nomeProp}*! 👋\n\nSegue sua fatura de *${periodo}*:\n💰 Total: *${valF}*${pix ? `\n\n🏦 PIX: *${pix}*` : ""}\n\nQualquer dúvida, estou à disposição!`;
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], "fatura.png", { type: "image/png" })] })) {
          try { await navigator.share({ files: [new File([blob], `Fatura_${nomeProp}_${periodo}.png`, { type: "image/png" })], text: msg }); return; } catch (e) {}
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `Fatura_${nomeProp}_${periodo}.png`; link.click();
        URL.revokeObjectURL(url);
        setTimeout(() => { window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank"); }, 800);
        this.mostrarNotificacao("Imagem salva! Agora anexe no WhatsApp.");
      }, "image/png");
    } catch (e) {
      this.mostrarNotificacao("Erro ao gerar card.", "erro");
    }
  },

  cobrarWhatsApp(nome, telefone, valor, descricao, periodo) {
    this.vibrar();
    const tel = telefone.replace(/\D/g, "");
    const msg = `Olá *${nome}*! 👋\n\nPassando para lembrar sobre o pagamento pendente:\n\n📋 *${descricao}*\n📅 Período: ${periodo}\n💰 Valor: *${valor}*\n\n${this.chavePixCache ? `Chave PIX para pagamento:\n*${this.chavePixCache}*\n\n` : ""}Qualquer dúvida, estou à disposição!`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  },

  async abrirHistoricoCliente(propId, nomeProp) {
    this.vibrar();
    if (!this.bsModalHistoricoCliente) this.bsModalHistoricoCliente = new bootstrap.Modal(document.getElementById("modalHistoricoCliente"));
    document.getElementById("tituloHistoricoCliente").textContent = nomeProp;
    document.getElementById("subtituloHistoricoCliente").textContent = "Últimos 12 meses";
    document.getElementById("listaHistoricoCliente").innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);">Carregando...</div>`;
    this.bsModalHistoricoCliente.show();
    try {
      const dados = await ApiService.fetchData(`/api/dashboard/historico-cliente/${propId}`);
      if (!dados) return;
      document.getElementById("statEmDia").textContent = dados.stats.mesesEmDia;
      document.getElementById("statAtrasados").textContent = dados.stats.mesesAtrasados;
      document.getElementById("statPontualidade").textContent = `${dados.stats.taxaPagamento}%`;

      // Gráfico de barras empilhadas (pago × pendente)
      const comDados = dados.historico.filter((h) => h.totalMes > 0);
      const wrapGraf = document.getElementById("wrapGraficoHistorico");
      const canvasGraf = document.getElementById("graficoHistoricoCliente");
      if (wrapGraf && canvasGraf && comDados.length > 0) {
        wrapGraf.classList.remove("d-none");
        if (this.chartHistoricoCliente) this.chartHistoricoCliente.destroy();
        const nomes3 = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const labels = comDados.map((h) => `${nomes3[h.mes - 1]}/${String(h.ano).slice(2)}`);
        this.chartHistoricoCliente = new Chart(canvasGraf, {
          type: "bar",
          data: {
            labels,
            datasets: [
              { label: "Pago", data: comDados.map((h) => h.totalPago), backgroundColor: "rgba(61,122,94,0.75)", borderRadius: 4, stack: "s" },
              { label: "Pendente", data: comDados.map((h) => Math.max(0, h.totalMes - h.totalPago)), backgroundColor: "rgba(168,50,50,0.65)", borderRadius: 4, stack: "s" },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", align: "end", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10, family: "'DM Sans',sans-serif" }, color: "#8A6840" } },
              tooltip: { backgroundColor: "rgba(61,30,10,0.92)", bodyFont: { size: 10, family: "'DM Sans',sans-serif" }, padding: 8,
                callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` } },
            },
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, color: "#8A6840" } },
              y: { stacked: true, grid: { color: "rgba(196,154,74,0.07)" }, ticks: { font: { size: 9 }, color: "#8A6840", callback: (v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}` } },
            },
          },
        });
      }

      const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      const lista = document.getElementById("listaHistoricoCliente");
      lista.innerHTML = dados.historico.filter((h) => h.totalMes > 0).reverse().map((h) => {
        const totalF = h.totalMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const cor = h.temPendente ? "var(--vermelho)" : "var(--verde)";
        const bg = h.temPendente ? "rgba(168,50,50,0.08)" : "rgba(61,122,94,0.08)";
        const icone = h.temPendente ? "fa-clock" : "fa-check-circle";
        const status = h.temPendente ? "Pendente" : "Pago";
        return `
          <div style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:16px;padding:12px 14px;margin-bottom:8px;box-shadow:var(--sombra);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-family:'Lora',serif;font-size:0.92rem;font-weight:600;color:var(--texto-titulo);">${nomesMeses[h.mes - 1]} ${h.ano}</div>
                <div style="font-size:0.72rem;color:var(--texto-suave);margin-top:2px;">${h.mensalidades.map((m) => `${m.cavalo}: ${m.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" · ")}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:var(--texto-titulo);font-size:0.9rem;">${totalF}</div>
                <div style="background:${bg};color:${cor};border-radius:8px;padding:2px 8px;font-size:0.7rem;font-weight:600;margin-top:3px;display:inline-flex;align-items:center;gap:4px;"><i class="fa-solid ${icone}" style="font-size:0.65rem;"></i>${status}</div>
              </div>
            </div>
          </div>`;
      }).join("") || `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Nenhum registro nos últimos 12 meses.</div>`;
    } catch (e) {}
  },

  async abrirModalLoteMensalidade() {
    this.vibrar();
    if (!this.bsModalLote) this.bsModalLote = new bootstrap.Modal(document.getElementById("modalLoteMensalidade"));
    const hoje = new Date();
    document.getElementById("loteMes").value = hoje.getMonth() + 1;
    document.getElementById("loteAno").value = hoje.getFullYear();
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const mesPrev = hoje.getMonth() === 0 ? 11 : hoje.getMonth() - 1;
    const label = document.getElementById("labelCopiarMes");
    if (label) label.textContent = `Copiar valores de ${meses[mesPrev]}`;
    const selMes = document.getElementById("loteMes");
    selMes.onchange = () => {
      const m = parseInt(selMes.value);
      const prev = m === 1 ? 12 : m - 1;
      if (label) label.textContent = `Copiar valores de ${meses[prev - 1]}`;
    };
    const propId = this.proprietarioAtualId;
    const todos = await ApiService.fetchData("/api/gestao/cavalos");
    this._loteAnimais = (todos || []).filter((c) => c.proprietario_id == propId);
    this._renderLoteAnimais();
    this.bsModalLote.show();
  },

  _renderLoteAnimais(valoresPreenchidos = {}) {
    const lista = document.getElementById("loteAnimaisLista");
    if (!this._loteAnimais?.length) { lista.innerHTML = `<div class="text-muted small">Nenhum animal cadastrado.</div>`; return; }
    lista.innerHTML = this._loteAnimais.map((c) => {
      const valorCopiar = valoresPreenchidos[c.id];
      const valorPadrao = c.valor_mensalidade_padrao ? parseFloat(c.valor_mensalidade_padrao) : null;
      const valorFinal = valorCopiar != null
        ? valorCopiar.toString().replace(".", ",")
        : valorPadrao != null
          ? valorPadrao.toFixed(2).replace(".", ",")
          : "";
      const temPadrao = valorCopiar == null && valorPadrao != null;
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--bege-borda);">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="avatar-circle avatar-cavalo" style="width:28px;height:28px;font-size:11px;">${c.nome.charAt(0)}</div>
          <div>
            <span style="font-size:0.85rem;font-weight:600;color:var(--texto-titulo);">${c.nome}</span>
            ${temPadrao ? `<div style="font-size:0.65rem;color:var(--texto-suave);">valor padrão</div>` : ""}
          </div>
        </div>
        <input type="text" inputmode="decimal" placeholder="R$ valor" data-cavalo="${c.id}"
          value="${valorFinal}"
          style="width:100px;border:0.5px solid var(--bege-borda);border-radius:10px;padding:5px 8px;font-size:0.8rem;text-align:right;background:var(--bege-fundo);" class="lote-valor-individual"/>
      </div>`;
    }).join("");
  },

  async copiarMesAnterior() {
    const mes = parseInt(document.getElementById("loteMes").value);
    const ano = parseInt(document.getElementById("loteAno").value);
    const mesPrev = mes === 1 ? 12 : mes - 1;
    const anoPrev = mes === 1 ? ano - 1 : ano;
    const btn = document.getElementById("btnCopiarMesAnt");
    if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
    try {
      const valores = {};
      await Promise.all((this._loteAnimais || []).map(async (c) => {
        try {
          const dados = await ApiService.fetchData(`/api/gestao/mensalidades/${c.id}?mes=${mesPrev}&ano=${anoPrev}`);
          if (dados?.valor) valores[c.id] = parseFloat(dados.valor);
        } catch (e) {}
      }));
      if (!Object.keys(valores).length) { this.mostrarNotificacao("Nenhum valor encontrado no mês anterior.", "erro"); return; }
      this._renderLoteAnimais(valores);
      const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      this.mostrarNotificacao(`Valores de ${meses[mesPrev - 1]} copiados!`);
    } catch (e) {
      this.mostrarNotificacao("Erro ao buscar valores.", "erro");
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
    }
  },

  async confirmarLoteMensalidade() {
    this.vibrar();
    const mes = parseInt(document.getElementById("loteMes").value);
    const ano = parseInt(document.getElementById("loteAno").value);
    const vPad = parseFloat((document.getElementById("loteValor").value || "0").replace(",", ".")) || 0;
    const propId = this.proprietarioAtualId;
    const itens = [];
    document.querySelectorAll(".lote-valor-individual").forEach((inp) => {
      const val = parseFloat(inp.value.replace(",", "."));
      if (!isNaN(val) && val > 0) itens.push({ cavalo_id: inp.dataset.cavalo, valor: val });
    });
    try {
      const res = await ApiService.postData("/api/gestao/mensalidades/lote", { proprietario_id: propId, mes, ano, valor_padrao: vPad, itens });
      this.bsModalLote.hide();
      this.mostrarNotificacao(res.message || "Lançado!");
      this.carregarFaturaProprietario(propId, document.getElementById("tituloDetalhesProp").textContent, document.getElementById("subtituloDetalhesProp").textContent);
    } catch (e) {
      this.mostrarNotificacao("Erro ao lançar.", "erro");
    }
  },

  async gerarPDFProprietario() {
    const nome = document.getElementById("tituloDetalhesProp").textContent;
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const res = await this._gerarDocPDFDados(this.proprietarioAtualId, nome, periodo, this.dataFiltroProp.getMonth() + 1, this.dataFiltroProp.getFullYear());
    if (res) res.doc.save(`Fatura_${nome.trim()}.pdf`);
    else this.mostrarNotificacao("Sem dados.", "erro");
  },

  async _gerarDocPDFDados(propId, nomeProp, periodo, mes, ano) {
    if (!window.jspdf) return null;
    const { jsPDF } = window.jspdf, doc = new jsPDF();
    doc.setTextColor(61, 30, 10); doc.setFontSize(18);
    doc.text(document.getElementById("brandName").textContent, 14, 20);
    doc.setTextColor(0); doc.setFontSize(12);
    doc.text(`Fatura / Extrato`, 14, 28);
    doc.text(`Cliente: ${nomeProp}`, 14, 35);
    doc.text(`Período: ${periodo}`, 14, 42);
    let rows = [], total = 0;
    const all = await ApiService.fetchData("/api/gestao/cavalos");
    for (const c of all.filter((x) => x.proprietario_id == propId)) {
      const d = await ApiService.fetchData(`/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`);
      if (d.custos) d.custos.forEach((x) => {
        total += parseFloat(x.valor);
        rows.push([new Date(x.data_despesa).toLocaleDateString("pt-BR"), `Animal: ${c.nome}`, `${x.descricao} ${x.pago ? "(Pago)" : ""}`, parseFloat(x.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]);
      });
    }
    const dir = await ApiService.fetchData(`/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`);
    if (dir) dir.forEach((x) => {
      total += parseFloat(x.valor);
      rows.push([new Date(x.data_despesa).toLocaleDateString("pt-BR"), "Avulso", `${x.descricao} ${x.pago ? "(Pago)" : ""}`, parseFloat(x.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]);
    });
    if (!rows.length) return null;
    doc.autoTable({ startY: 50, head: [["Data", "Ref", "Descrição", "Valor"]], body: rows, theme: "grid", headStyles: { fillColor: [61, 30, 10] }, columnStyles: { 3: { halign: "right", fontStyle: "bold" } } });
    doc.setFontSize(14);
    doc.text(`TOTAL GERAL: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 195, doc.lastAutoTable.finalY + 15, { align: "right" });
    return { doc };
  },
});
