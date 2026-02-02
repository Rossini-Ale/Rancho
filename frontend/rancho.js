const RanchoApp = {
  // --- VARIÁVEIS DE ESTADO ---
  bsModalProp: null,
  bsModalCavalo: null,
  bsModalFin: null,
  bsModalConfig: null,
  bsModalMed: null,
  bsModalDetalhesProp: null,
  bsToast: null,
  bsModalConfirm: null,
  deferredPrompt: null,
  chartInstance: null,

  dataFiltro: new Date(),
  dataFiltroProp: new Date(),
  abaAtual: "cavalos",
  proprietarioAtualId: null,

  // --- INICIALIZAÇÃO ---
  async init() {
    // Inicializa Modais do Bootstrap
    this.bsModalProp = new bootstrap.Modal(
      document.getElementById("modalProprietario"),
    );
    this.bsModalCavalo = new bootstrap.Modal(
      document.getElementById("modalCavalo"),
    );
    this.bsModalFin = new bootstrap.Modal(
      document.getElementById("modalFinanceiro"),
    );
    this.bsModalConfig = new bootstrap.Modal(
      document.getElementById("modalConfig"),
    );
    this.bsModalMed = new bootstrap.Modal(
      document.getElementById("modalMedicamentos"),
    );
    this.bsModalDetalhesProp = new bootstrap.Modal(
      document.getElementById("modalDetalhesProprietario"),
    );
    this.bsModalConfirm = new bootstrap.Modal(
      document.getElementById("modalConfirmacao"),
    );

    // Inicializa Toast de Notificação
    const toastEl = document.getElementById("liveToast");
    if (toastEl) this.bsToast = new bootstrap.Toast(toastEl);

    // Configura PWA e Listeners
    this.setupPWA();
    this.setupListeners();

    // Carrega Dados Iniciais
    await this.carregarConfiguracoes();
    await this.carregarProprietariosSelect();
    await this.carregarTabelaCavalos();
    await this.carregarTabelaProprietarios();
  },

  setupListeners() {
    // Máscaras de Input
    const telInput = document.getElementById("propTelefone");
    if (telInput)
      telInput.addEventListener("input", (e) => this.mascaraTelefone(e));

    ["custoValor", "medValor", "custoPropValor"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", (e) => this.mascaraMoeda(e));
    });

    // Submissão de Formulários
    document
      .getElementById("formProprietario")
      .addEventListener("submit", (e) => this.salvarProprietario(e));
    document
      .getElementById("formCavalo")
      .addEventListener("submit", (e) => this.salvarCavalo(e));
    document
      .getElementById("formConfig")
      .addEventListener("submit", (e) => this.salvarConfig(e));
    document
      .getElementById("formMedicamento")
      .addEventListener("submit", (e) => this.salvarMedicamento(e));
    document
      .getElementById("formCusto")
      .addEventListener("submit", (e) => this.salvarCusto(e));
    document
      .getElementById("formCustoProp")
      .addEventListener("submit", (e) => this.salvarCustoProp(e));

    // Busca e Logout
    document
      .getElementById("inputBusca")
      .addEventListener("keyup", (e) => this.filtrarTabela(e.target.value));
    document
      .getElementById("logoutButton")
      .addEventListener("click", async () => {
        this.vibrar();
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {}
        localStorage.removeItem("token");
        window.location.href = "login.html";
      });
  },

  // --- HELPERS (UX & FORMATAÇÃO) ---
  vibrar(ms = 50) {
    if (navigator.vibrate) navigator.vibrate(ms);
  },

  mascaraTelefone(e) {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = v;
  },

  mascaraMoeda(e) {
    let value = e.target.value.replace(/\D/g, "");
    value = (Number(value) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    e.target.value = value;
  },

  limparMoeda(valorStr) {
    if (!valorStr) return 0;
    return parseFloat(valorStr.replace(/[^\d,]/g, "").replace(",", "."));
  },

  setLoading(btn, isLoading, textOriginal) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${textOriginal}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = textOriginal;
    }
  },

  mostrarNotificacao(msg, tipo = "sucesso") {
    const tm = document.getElementById("toastMessage");
    const te = document.getElementById("liveToast");
    tm.innerHTML = msg;
    const classe = tipo === "erro" ? "text-bg-danger" : "text-bg-success";
    te.className = `toast align-items-center border-0 ${classe}`;
    if (this.bsToast) this.bsToast.show();
    if (tipo === "erro") this.vibrar([50, 50, 50]);
    else this.vibrar(100);
  },

  abrirConfirmacao(titulo, mensagem, callback) {
    this.vibrar();
    document.getElementById("tituloConfirmacao").textContent = titulo;
    document.getElementById("msgConfirmacao").textContent = mensagem;
    const btn = document.getElementById("btnConfirmarAcao");
    const novoBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(novoBtn, btn);
    novoBtn.onclick = () => {
      this.bsModalConfirm.hide();
      this.vibrar();
      callback();
    };
    this.bsModalConfirm.show();
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
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === "accepted")
        document.getElementById("btnInstalarApp").classList.add("d-none");
      this.deferredPrompt = null;
    }
  },

  // --- NAVEGAÇÃO ---
  mudarAba(aba) {
    this.vibrar(30);
    this.abaAtual = aba;
    const btnCavalos = document.getElementById("btnTabCavalos");
    const btnProps = document.getElementById("btnTabProprietarios");
    const divCavalos = document.getElementById("tabCavalos");
    const divProps = document.getElementById("tabProprietarios");

    if (aba === "cavalos") {
      btnCavalos.className =
        "btn btn-primary rounded-pill px-4 fw-bold flex-grow-1";
      btnProps.className =
        "btn btn-light bg-white border text-secondary rounded-pill px-4 fw-bold flex-grow-1";
      divCavalos.classList.remove("d-none");
      divProps.classList.add("d-none");
    } else {
      btnProps.className =
        "btn btn-primary rounded-pill px-4 fw-bold flex-grow-1";
      btnCavalos.className =
        "btn btn-light bg-white border text-secondary rounded-pill px-4 fw-bold flex-grow-1";
      divProps.classList.remove("d-none");
      divCavalos.classList.add("d-none");
    }
    document.getElementById("inputBusca").value = "";
    this.filtrarTabela("");
  },

  filtrarTabela(termo) {
    const selector =
      this.abaAtual === "cavalos"
        ? "#listaCavalosBody tr"
        : "#listaProprietariosMainBody tr";
    const linhas = document.querySelectorAll(selector);
    const t = termo.toLowerCase();
    linhas.forEach((linha) => {
      linha.style.display = linha.textContent.toLowerCase().includes(t)
        ? ""
        : "none";
    });
  },

  // --- CONFIGURAÇÕES ---
  async carregarConfiguracoes() {
    try {
      const res = await ApiService.fetchData("/api/gestao/config");
      if (res && res.nome_rancho) {
        document.getElementById("brandName").textContent = res.nome_rancho;
        document.title = res.nome_rancho;
      }
    } catch (e) {}
  },

  abrirModalConfig() {
    this.vibrar();
    document.getElementById("configNomeRancho").value =
      document.getElementById("brandName").textContent;
    this.bsModalConfig.show();
  },

  async salvarConfig(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSalvarConfig");
    this.setLoading(btn, true, "Salvar");
    try {
      await ApiService.putData("/api/gestao/config", {
        nome_rancho: document.getElementById("configNomeRancho").value,
      });
      this.carregarConfiguracoes();
      this.bsModalConfig.hide();
      this.mostrarNotificacao("Salvo!");
    } catch (e) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, "Salvar");
    }
  },

  // --- CAVALOS ---
  async carregarTabelaCavalos() {
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const tbody = document.getElementById("listaCavalosBody");
      tbody.innerHTML = "";
      document.getElementById("totalCavalos").textContent = cavalos
        ? cavalos.length
        : 0;

      // --- CORREÇÃO: Pegar Data Atual ---
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      if (cavalos && cavalos.length > 0) {
        for (const cavalo of cavalos) {
          // --- CORREÇÃO: Enviar ?mes=X&ano=Y na URL ---
          const dadosFin = await ApiService.fetchData(
            `/api/gestao/custos/resumo/${cavalo.id}?mes=${mesAtual}&ano=${anoAtual}`,
          );

          const totalFormatado = parseFloat(
            dadosFin.total_gasto || 0,
          ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const nomeSafe = cavalo.nome.replace(/'/g, "\\'");
          const lugarSafe = (cavalo.lugar || "").replace(/'/g, "\\'");
          const obsSafe = (cavalo.observacoes || "").replace(/'/g, "\\'");

          let avatarHtml = `<div class="avatar-circle avatar-cavalo">${cavalo.nome.charAt(0).toUpperCase()}</div>`;

          const tr = document.createElement("tr");
          tr.innerHTML = `
                <td class="nome-clicavel" onclick="RanchoApp.abrirModalEditar(${cavalo.id}, '${nomeSafe}', '${lugarSafe}', '${cavalo.proprietario_id || ""}', '${obsSafe}')">
                    <div class="d-flex align-items-center">${avatarHtml}
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 1.05rem;">${cavalo.nome}</div>
                        <div class="text-muted small"><i class="fa-solid fa-location-dot me-1"></i> ${cavalo.lugar || "N/D"}</div>
                    </div></div>
                </td>
                <td class="d-none d-md-table-cell text-muted"><i class="fa-solid fa-user me-1"></i> ${cavalo.nome_proprietario || "Sem dono"}</td>
                <td class="text-nowrap"><div class="d-flex flex-column align-items-end align-items-md-start"><span class="d-md-none small text-muted">Mês Atual</span><span class="text-danger fw-bold">${totalFormatado}</span></div></td>
                <td class="text-end">
                    <button class="btn-action btn-light text-success me-1 btn-med" onclick="event.stopPropagation();RanchoApp.abrirMedicamentos(${cavalo.id},'${nomeSafe}')"><i class="fa-solid fa-syringe"></i></button>
                    <button class="btn-action icon-gold me-1 btn-custos" onclick="event.stopPropagation();RanchoApp.abrirFinanceiro(${cavalo.id},'${nomeSafe}')"><i class="fa-solid fa-coins"></i></button>
                </td>`;
          tbody.appendChild(tr);
        }
      } else {
        tbody.innerHTML =
          '<tr><td colspan="4" class="text-center text-muted p-4">Nenhum animal cadastrado.</td></tr>';
      }
    } catch (error) {
      console.error("Erro cavalos", error);
    }
  },

  abrirModalNovoCavalo() {
    this.vibrar();
    document.getElementById("formCavalo").reset();
    document.getElementById("cavaloId").value = "";
    document.getElementById("tituloModalCavalo").textContent = "Novo Animal";
    document.getElementById("btnExcluirCavalo").classList.add("d-none");
    this.bsModalCavalo.show();
  },

  abrirModalEditar(id, nome, lugar, propId, obs) {
    this.vibrar();
    document.getElementById("cavaloId").value = id;
    document.getElementById("cavaloNome").value = nome;
    document.getElementById("cavaloLugar").value = lugar;
    document.getElementById("cavaloProprietario").value = propId;
    document.getElementById("cavaloObs").value = obs;
    document.getElementById("tituloModalCavalo").textContent =
      `Editar: ${nome}`;
    document.getElementById("btnExcluirCavalo").classList.remove("d-none");
    this.bsModalCavalo.show();
  },

  async salvarCavalo(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, "Salvar");

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
      this.mostrarNotificacao("Ficha salva!");
    } catch (err) {
      this.mostrarNotificacao("Erro ao salvar.", "erro");
    } finally {
      this.setLoading(btn, false, "Salvar");
    }
  },

  excluirCavaloAtual() {
    const id = document.getElementById("cavaloId").value;
    if (id) {
      this.abrirConfirmacao("Excluir", "Apagar ficha?", async () => {
        try {
          await ApiService.deleteData(`/api/gestao/cavalos/${id}`);
          this.bsModalCavalo.hide();
          this.carregarTabelaCavalos();
          this.mostrarNotificacao("Removido.");
        } catch (e) {
          this.mostrarNotificacao("Erro.", "erro");
        }
      });
    }
  },

  // --- PROPRIETÁRIOS ---
  async carregarTabelaProprietarios() {
    try {
      const props = await ApiService.fetchData("/api/gestao/proprietarios");
      const cavalos = (await ApiService.fetchData("/api/gestao/cavalos")) || [];
      const tbody = document.getElementById("listaProprietariosMainBody");
      tbody.innerHTML = "";
      document.getElementById("totalProprietarios").textContent = props
        ? props.length
        : 0;

      if (!props || props.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="3" class="text-center text-muted p-4">Nenhum cliente cadastrado.</td></tr>';
        return;
      }

      props.forEach((p) => {
        const nCavalos = cavalos.filter(
          (c) => c.proprietario_id == p.id,
        ).length;
        const txt = nCavalos === 1 ? "1 animal" : `${nCavalos} animais`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="nome-clicavel" onclick="RanchoApp.abrirDetalhesProprietario(${p.id},'${p.nome}','${p.telefone || ""}')">
                <div class="d-flex align-items-center">
                    <div class="avatar-circle avatar-dono">${p.nome.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="fw-bold text-dark">${p.nome}</div>
                        <div class="text-primary small fw-bold mt-1"><i class="fa-solid fa-horse-head me-1"></i> ${txt}</div>
                    </div>
                </div>
            </td>
            <td class="d-none d-md-table-cell text-muted"><i class="fa-solid fa-phone me-1"></i> ${p.telefone || "-"}</td>
            <td class="text-end">
                <a href="${p.telefone ? `https://wa.me/55${p.telefone.replace(/\D/g, "")}` : "#"}" target="_blank" class="btn-action btn-light text-success me-1 text-decoration-none d-inline-flex align-items-center justify-content-center"><i class="fa-brands fa-whatsapp fs-5"></i></a>
                <button class="btn-action icon-brown me-1 btn-edit"><i class="fa-solid fa-pen"></i></button>
            </td>`;
        tr.querySelector(".btn-edit").onclick = (e) => {
          e.stopPropagation();
          this.abrirModalGerenciarProprietarios(p.id, p.nome, p.telefone);
        };
        tbody.appendChild(tr);
      });
    } catch (err) {}
  },

  abrirModalGerenciarProprietarios(id = null, nome = "", telefone = "") {
    this.vibrar();
    document.getElementById("formProprietario").reset();
    if (id) {
      document.getElementById("propId").value = id;
      document.getElementById("propNome").value = nome;
      document.getElementById("propTelefone").value = telefone;
      document.getElementById("tituloModalProp").textContent = "Editar";
      document.getElementById("btnExcluirProp").classList.remove("d-none");
    } else {
      document.getElementById("propId").value = "";
      document.getElementById("tituloModalProp").textContent = "Novo Dono";
      document.getElementById("btnExcluirProp").classList.add("d-none");
    }
    this.bsModalProp.show();
  },

  async salvarProprietario(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, "Salvar");
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
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, "Salvar");
    }
  },

  excluirProprietarioAtual() {
    const id = document.getElementById("propId").value;
    if (id) {
      this.abrirConfirmacao("Excluir", "Apagar cliente?", async () => {
        try {
          await ApiService.deleteData(`/api/gestao/proprietarios/${id}`);
          this.bsModalProp.hide();
          this.carregarTabelaProprietarios();
          this.carregarProprietariosSelect();
          this.mostrarNotificacao("Excluído!");
        } catch (err) {
          this.mostrarNotificacao("Erro", "erro");
        }
      });
    }
  },

  async carregarProprietariosSelect() {
    try {
      const props = await ApiService.fetchData("/api/gestao/proprietarios");
      const select = document.getElementById("cavaloProprietario");
      select.innerHTML = '<option value="">Selecione...</option>';
      if (props)
        props.forEach(
          (p) =>
            (select.innerHTML += `<option value="${p.id}">${p.nome}</option>`),
        );
    } catch (e) {}
  },

  // --- FINANCEIRO (CAVALO) ---
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
    this.dataFiltro = new Date();
    this.atualizarLabelMes();
    this.bsModalFin.show();
    this.carregarListaCustos(cavaloId);
  },

  async carregarListaCustos(cavaloId) {
    const mes = this.dataFiltro.getMonth() + 1;
    const ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(
      `/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`,
    );
    const tbody = document.getElementById("tabelaCustosBody");
    tbody.innerHTML = "";

    this.renderizarGrafico(dados && dados.custos ? dados.custos : []);

    if (dados && dados.custos && dados.custos.length > 0) {
      dados.custos.forEach((c) => {
        const dia = new Date(c.data_despesa).getDate();
        const mesNome = new Date(c.data_despesa)
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", "")
          .toUpperCase();
        const valorF = parseFloat(c.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const descSafe = c.descricao.replace(/'/g, "\\'");
        tbody.innerHTML += `<tr><td><div class="d-flex align-items-center"><div class="date-badge"><span class="date-day">${dia}</span><span>${mesNome}</span></div><div><div class="fw-bold text-dark">${c.descricao}</div><div class="text-muted small">${c.categoria}</div></div></div></td><td class="text-end"><div class="d-flex align-items-center justify-content-end gap-1"><span class="text-danger fw-bold me-2">${valorF}</span><button class="btn-action icon-brown me-1" onclick="RanchoApp.prepararEdicaoCusto(${c.id}, '${descSafe}', '${c.categoria}', ${c.valor})"><i class="fa-solid fa-pen"></i></button><button class="btn-action icon-red btn-del-custo" onclick="RanchoApp.excluirCusto(${c.id}, ${cavaloId})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;
      });
      document.getElementById("totalGastoModal").textContent = parseFloat(
        dados.total_gasto,
      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } else {
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted p-3">Nenhum custo neste mês.</td></tr>';
      document.getElementById("totalGastoModal").textContent = "R$ 0,00";
    }
  },

  prepararEdicaoCusto(id, desc, cat, valor) {
    this.vibrar();
    document.getElementById("custoIdEdit").value = id;
    document.getElementById("custoDesc").value = desc;
    document.getElementById("custoCat").value = cat;
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
    const body = {
      cavalo_id: cavaloId,
      proprietario_id: null,
      descricao: document.getElementById("custoDesc").value,
      categoria: document.getElementById("custoCat").value,
      valor: this.limparMoeda(document.getElementById("custoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
    };

    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const cavalo = cavalos.find((c) => c.id == cavaloId);
      if (cavalo) body.proprietario_id = cavalo.proprietario_id;

      if (isEdit) {
        try {
          await ApiService.putData(`/api/gestao/custos/${custoId}`, body);
          this.mostrarNotificacao("Atualizado!");
        } catch (err) {
          await ApiService.deleteData(`/api/gestao/custos/${custoId}`);
          await ApiService.postData("/api/gestao/custos", body);
          this.mostrarNotificacao("Corrigido!");
        }
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

  mudarMes(delta) {
    this.vibrar(20);
    this.dataFiltro.setMonth(this.dataFiltro.getMonth() + delta);
    this.atualizarLabelMes();
    this.carregarListaCustos(document.getElementById("finCavaloId").value);
  },

  atualizarLabelMes() {
    document.getElementById("labelMesAno").textContent = this.dataFiltro
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .toUpperCase();
  },

  renderizarGrafico(custos) {
    const ctx = document.getElementById("graficoFinanceiro");
    const area = document.getElementById("areaGrafico");
    if (!custos || custos.length === 0) {
      area.style.display = "none";
      return;
    }
    area.style.display = "block";
    const dados = {};
    custos.forEach((c) => {
      const cat = c.categoria || "Outros";
      if (!dados[cat]) dados[cat] = 0;
      dados[cat] += parseFloat(c.valor);
    });
    if (this.chartInstance) this.chartInstance.destroy();
    this.chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(dados),
        datasets: [
          {
            data: Object.values(dados),
            backgroundColor: [
              "#8B4513",
              "#D2691E",
              "#CD853F",
              "#DEB887",
              "#A0522D",
              "#F4A460",
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
            labels: { boxWidth: 12, font: { size: 10 } },
          },
        },
      },
    });
  },

  // --- CUSTOS AVULSOS ---
  prepararEdicaoCustoProp(id, desc, valor) {
    this.vibrar();
    document.getElementById("custoPropIdEdit").value = id;
    document.getElementById("custoPropDesc").value = desc;
    document.getElementById("custoPropValor").value = parseFloat(
      valor,
    ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const btn = document.getElementById("btnSalvarCustoProp");
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    btn.classList.replace("btn-success", "btn-warning");
    document.getElementById("custoPropDesc").focus();
  },

  async salvarCustoProp(e) {
    e.preventDefault();
    const btn = e.submitter;
    const custoId = document.getElementById("custoPropIdEdit").value;
    const isEdit = !!custoId;
    this.setLoading(
      btn,
      true,
      isEdit
        ? '<i class="fa-solid fa-rotate"></i>'
        : '<i class="fa-solid fa-plus"></i>',
    );

    const body = {
      proprietario_id: this.proprietarioAtualId,
      cavalo_id: null,
      descricao: document.getElementById("custoPropDesc").value,
      valor: this.limparMoeda(document.getElementById("custoPropValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
      categoria: "Avulso",
    };

    try {
      if (isEdit) {
        try {
          await ApiService.putData(`/api/gestao/custos/${custoId}`, body);
          this.mostrarNotificacao("Atualizado!");
        } catch (err) {
          await ApiService.deleteData(`/api/gestao/custos/${custoId}`);
          await ApiService.postData("/api/gestao/custos", body);
          this.mostrarNotificacao("Corrigido!");
        }
      } else {
        await ApiService.postData("/api/gestao/custos", body);
        this.mostrarNotificacao("Lançado!");
      }
      document.getElementById("formCustoProp").reset();
      document.getElementById("custoPropIdEdit").value = "";
      document
        .getElementById("btnSalvarCustoProp")
        .classList.replace("btn-warning", "btn-success");
      document.getElementById("btnSalvarCustoProp").innerHTML =
        '<i class="fa-solid fa-plus"></i>';
      this.carregarFaturaProprietario(
        this.proprietarioAtualId,
        document.getElementById("tituloDetalhesProp").textContent,
        document.getElementById("subtituloDetalhesProp").textContent,
      );
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(
        btn,
        false,
        isEdit
          ? '<i class="fa-solid fa-rotate"></i>'
          : '<i class="fa-solid fa-plus"></i>',
      );
    }
  },

  async abrirDetalhesProprietario(id, nome, telefone) {
    this.vibrar();
    this.proprietarioAtualId = id;
    document.getElementById("tituloDetalhesProp").textContent = nome;
    document.getElementById("subtituloDetalhesProp").textContent =
      telefone || "Sem telefone";
    document.getElementById("formCustoProp").reset();
    document.getElementById("custoPropIdEdit").value = "";
    document.getElementById("btnSalvarCustoProp").innerHTML =
      '<i class="fa-solid fa-plus"></i>';
    document
      .getElementById("btnSalvarCustoProp")
      .classList.replace("btn-warning", "btn-success");
    this.dataFiltroProp = new Date();
    this.atualizarLabelMesProp();
    this.bsModalDetalhesProp.show();
    this.carregarFaturaProprietario(id, nome, telefone);
  },

  mudarMesProp(delta) {
    this.vibrar(20);
    this.dataFiltroProp.setMonth(this.dataFiltroProp.getMonth() + delta);
    this.atualizarLabelMesProp();
    this.carregarFaturaProprietario(
      this.proprietarioAtualId,
      document.getElementById("tituloDetalhesProp").textContent,
      document.getElementById("subtituloDetalhesProp").textContent,
    );
  },

  atualizarLabelMesProp() {
    document.getElementById("labelMesAnoProp").textContent = this.dataFiltroProp
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .toUpperCase();
  },

  async carregarFaturaProprietario(propId, nomeProp, telefoneProp) {
    const tbody = document.getElementById("listaCavalosPropBody");
    tbody.innerHTML =
      '<tr><td colspan="2" class="text-center p-3">Carregando...</td></tr>';
    try {
      const mes = this.dataFiltroProp.getMonth() + 1;
      const ano = this.dataFiltroProp.getFullYear();
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meusCavalos = allCavalos.filter((c) => c.proprietario_id == propId);

      const pCavalos = meusCavalos.map(async (c) => {
        const d = await ApiService.fetchData(
          `/api/gestao/custos/resumo/${c.id}?mes=${mes}&ano=${ano}`,
        );
        return d.custos
          ? d.custos.map((i) => ({
              tipo: "cavalo",
              nome: `${c.nome} - ${i.descricao}`,
              custo: parseFloat(i.valor),
              id: i.id,
              pago: i.pago,
            }))
          : [];
      });
      const diretos = await ApiService.fetchData(
        `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
      );
      const itensDiretos = diretos.map((c) => ({
        tipo: "direto",
        nome: c.descricao,
        custo: parseFloat(c.valor),
        id: c.id,
        pago: c.pago,
      }));

      const res = await Promise.all(pCavalos);
      const lista = [...res.flat(), ...itensDiretos];

      if (!lista.length) {
        tbody.innerHTML =
          '<tr><td colspan="2" class="text-center text-muted p-4">Nenhum custo.</td></tr>';
        document.getElementById("totalGeralProp").textContent = "R$ 0,00";
        document.getElementById("btnBaixarFatura").classList.add("d-none");
        return;
      }

      let pendente = 0;
      let html = "";
      lista.forEach((item) => {
        const valorF = item.custo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        let actions = "";
        if (item.tipo === "direto" && !item.pago)
          actions += `<button class="btn btn-sm text-warning ms-1" onclick="RanchoApp.prepararEdicaoCustoProp(${item.id}, '${item.nome.replace(/'/g, "\\'")}', ${item.custo})"><i class="fa-solid fa-pen"></i></button>`;
        let statusIcon = "";
        if (item.pago) {
          statusIcon =
            '<i class="fa-solid fa-check-circle text-success me-2"></i>';
        } else {
          pendente += item.custo;
          actions += `<button class="btn btn-sm text-danger ms-1" onclick="RanchoApp.excluirCustoDireto(${item.id})"><i class="fa-solid fa-trash"></i></button>`;
        }
        if (item.tipo === "cavalo") actions = "";
        html += `<tr><td><div class="${item.pago ? "text-success fw-bold" : "text-dark"}">${statusIcon}${item.nome}</div></td><td class="text-end"><span>${valorF}</span>${actions}</td></tr>`;
      });

      tbody.innerHTML = html;
      if (pendente > 0) {
        document.getElementById("totalGeralProp").innerHTML =
          `<span class="text-danger">${pendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>`;
        document.getElementById("btnBaixarFatura").classList.remove("d-none");
      } else {
        document.getElementById("totalGeralProp").innerHTML =
          '<span class="text-success">Pago</span>';
        document.getElementById("btnBaixarFatura").classList.add("d-none");
      }

      const btnZap = document.getElementById("btnZapCobranca");
      const cleanTel = telefoneProp.replace(/\D/g, "");
      const novoBtnZap = btnZap.cloneNode(true);
      btnZap.parentNode.replaceChild(novoBtnZap, btnZap);

      novoBtnZap.onclick = async () => {
        try {
          const totalTexto =
            pendente > 0
              ? pendente.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
              : "QUITADO";
          await this.compartilharFaturaZap(
            propId,
            nomeProp,
            totalTexto,
            cleanTel,
          );
        } catch (e) {
          window.open(`https://wa.me/55${cleanTel}`, "_blank");
        }
      };
    } catch (err) {}
  },

  baixarFaturaMes() {
    this.abrirConfirmacao(
      "Baixar Fatura",
      "Confirmar recebimento?",
      async () => {
        try {
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
        } catch (err) {
          this.mostrarNotificacao("Erro", "erro");
        }
      },
    );
  },

  excluirCustoDireto(id) {
    this.abrirConfirmacao("Excluir", "Apagar custo?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/custos/${id}`);
        this.carregarFaturaProprietario(
          this.proprietarioAtualId,
          document.getElementById("tituloDetalhesProp").textContent,
          document.getElementById("subtituloDetalhesProp").textContent,
        );
        this.mostrarNotificacao("Apagado!");
      } catch (e) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },

  // --- MEDICAMENTOS ---
  async abrirMedicamentos(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("medCavaloId").value = cavaloId;
    document.getElementById("tituloModalMed").textContent =
      `Saúde: ${nomeCavalo}`;
    document.getElementById("formMedicamento").reset();
    document.getElementById("medData").valueAsDate = new Date();
    this.bsModalMed.show();
    this.carregarMedicamentos(cavaloId);
  },

  async salvarMedicamento(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, "Salvar");
    const valor = this.limparMoeda(document.getElementById("medValor").value);
    const body = {
      cavalo_id: document.getElementById("medCavaloId").value,
      nome_medicamento: document.getElementById("medNome").value,
      data_aplicacao: document.getElementById("medData").value,
      valor: valor,
      observacoes: "",
    };
    try {
      await ApiService.postData("/api/gestao/medicamentos", body);
      document.getElementById("formMedicamento").reset();
      document.getElementById("medData").valueAsDate = new Date();
      this.carregarMedicamentos(body.cavalo_id);
      this.carregarTabelaCavalos();
      this.mostrarNotificacao("Salvo!");
    } catch (err) {
      this.mostrarNotificacao("Erro", "erro");
    } finally {
      this.setLoading(btn, false, "Salvar");
    }
  },

  async carregarMedicamentos(cavaloId) {
    const meds = await ApiService.fetchData(
      `/api/gestao/medicamentos/${cavaloId}`,
    );
    const tbody = document.getElementById("tabelaMedBody");
    tbody.innerHTML = "";
    if (meds && meds.length) {
      meds.forEach((m) => {
        const data = new Date(m.data_aplicacao).toLocaleDateString("pt-BR");
        const val = parseFloat(m.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        tbody.innerHTML += `<tr><td><div class="fw-bold">${m.nome_medicamento}</div><div class="small">${data}</div></td><td class="text-end"><span class="text-success">${val}</span><button class="btn btn-sm text-danger ms-2" onclick="RanchoApp.excluirMedicamento(${m.id}, ${cavaloId})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
      });
    } else {
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted p-3">Nenhum registro.</td></tr>';
    }
  },

  excluirMedicamento(id, cavaloId) {
    this.abrirConfirmacao("Excluir", "Apagar registro?", async () => {
      try {
        await ApiService.deleteData(`/api/gestao/medicamentos/${id}`);
        this.carregarMedicamentos(cavaloId);
        this.mostrarNotificacao("Removido.");
      } catch (e) {
        this.mostrarNotificacao("Erro", "erro");
      }
    });
  },

  // --- PDF ---
  async _gerarDocPDFDados(propId, nomeProp, periodo, mes, ano) {
    if (!window.jspdf) return null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const nomeRancho = document.getElementById("brandName").textContent;

    doc.setTextColor(139, 69, 19);
    doc.setFontSize(18);
    doc.text(nomeRancho, 14, 20);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Fatura / Extrato`, 14, 28);
    doc.text(`Cliente: ${nomeProp}`, 14, 35);
    doc.text(`Período: ${periodo}`, 14, 42);

    let rows = [];
    let total = 0;
    const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
    const meus = allCavalos.filter((c) => c.proprietario_id == propId);

    for (const cavalo of meus) {
      const d = await ApiService.fetchData(
        `/api/gestao/custos/resumo/${cavalo.id}?mes=${mes}&ano=${ano}`,
      );
      if (d.custos) {
        d.custos.forEach((c) => {
          total += parseFloat(c.valor);
          const st = c.pago ? "(Pago)" : "";
          rows.push([
            new Date(c.data_despesa).toLocaleDateString("pt-BR"),
            `Animal: ${cavalo.nome}`,
            `${c.descricao} ${st}`,
            parseFloat(c.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
          ]);
        });
      }
    }
    const diretos = await ApiService.fetchData(
      `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
    );
    if (diretos) {
      diretos.forEach((c) => {
        total += parseFloat(c.valor);
        const st = c.pago ? "(Pago)" : "";
        rows.push([
          new Date(c.data_despesa).toLocaleDateString("pt-BR"),
          "Despesa Avulsa",
          `${c.descricao} ${st}`,
          parseFloat(c.valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
        ]);
      });
    }

    if (!rows.length) return null;

    doc.autoTable({
      startY: 50,
      head: [["Data", "Ref", "Descrição", "Valor"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [139, 69, 19] },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text(
      `TOTAL GERAL: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      195,
      finalY,
      { align: "right" },
    );
    return { doc };
  },

  async gerarPDFProprietario() {
    const nome = document.getElementById("tituloDetalhesProp").textContent;
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1;
    const ano = this.dataFiltroProp.getFullYear();
    const res = await this._gerarDocPDFDados(
      this.proprietarioAtualId,
      nome,
      periodo,
      mes,
      ano,
    );
    if (res) res.doc.save(`Fatura_${nome.trim()}.pdf`);
    else this.mostrarNotificacao("Sem dados.", "erro");
  },

  async compartilharFaturaZap(propId, nomeProp, totalTexto, telefone) {
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1;
    const ano = this.dataFiltroProp.getFullYear();
    const res = await this._gerarDocPDFDados(
      propId,
      nomeProp,
      periodo,
      mes,
      ano,
    );
    if (!res) {
      this.mostrarNotificacao("Sem dados.", "erro");
      return;
    }

    const pdfBlob = res.doc.output("blob");
    const file = new File([pdfBlob], `Fatura_${nomeProp.trim()}.pdf`, {
      type: "application/pdf",
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Fatura Rancho",
          text: `Olá ${nomeProp}, segue o detalhamento de ${periodo}. Total: ${totalTexto}`,
        });
      } catch (error) {}
    } else {
      res.doc.save(`Fatura_${nomeProp.trim()}.pdf`);
      const msg = `Olá *${nomeProp}*! 🤠\nSegue o fechamento de *${periodo}*.\n\n*TOTAL: ${totalTexto}*`;
      window.open(
        `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }
  },

  async gerarPDF() {
    if (!window.jspdf) {
      this.mostrarNotificacao("Carregando PDF...", "erro");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const cavaloId = document.getElementById("finCavaloId").value;
    const nomeCavalo = document
      .getElementById("tituloModalFin")
      .textContent.replace("Custos: ", "");
    const nomeRancho = document.getElementById("brandName").textContent;
    const periodo = document.getElementById("labelMesAno").textContent;
    const mes = this.dataFiltro.getMonth() + 1;
    const ano = this.dataFiltro.getFullYear();
    const dados = await ApiService.fetchData(
      `/api/gestao/custos/resumo/${cavaloId}?mes=${mes}&ano=${ano}`,
    );
    if (!dados || !dados.custos || dados.custos.length === 0) {
      this.mostrarNotificacao("Sem custos.", "erro");
      return;
    }

    doc.setTextColor(139, 69, 19);
    doc.setFontSize(18);
    doc.text(nomeRancho, 14, 20);
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
        fillColor: [139, 69, 19],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(200, 0, 0);
    doc.text(
      parseFloat(dados.total_gasto).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      195,
      finalY,
      { align: "right" },
    );
    doc.save(`${nomeCavalo.trim()}_${periodo.replace(" ", "_")}.pdf`);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  RanchoApp.init();
});
