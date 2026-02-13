const RanchoApp = {
  // Variáveis
  bsModalProp: null,
  bsModalCavalo: null,
  bsModalFin: null,
  bsModalConfig: null,
  bsModalMensalidade: null,
  bsModalDetalhesProp: null,
  bsToast: null,
  bsModalConfirm: null,
  deferredPrompt: null,
  chartInstance: null,
  chartRanchoInstance: null,

  dataFiltro: new Date(),
  dataFiltroProp: new Date(),
  dataFiltroRancho: new Date(),
  abaAtual: "cavalos",
  proprietarioAtualId: null,

  async init() {
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
    this.bsModalMensalidade = new bootstrap.Modal(
      document.getElementById("modalMensalidade"),
    );
    this.bsModalDetalhesProp = new bootstrap.Modal(
      document.getElementById("modalDetalhesProprietario"),
    );
    this.bsModalConfirm = new bootstrap.Modal(
      document.getElementById("modalConfirmacao"),
    );

    const toastEl = document.getElementById("liveToast");
    if (toastEl) this.bsToast = new bootstrap.Toast(toastEl);

    this.setupPWA();
    this.setupListeners();

    await this.carregarConfiguracoes();
    await this.carregarProprietariosSelect();
    await this.carregarTabelaCavalos();
    await this.carregarTabelaProprietarios();
  },

  setupListeners() {
    const telInput = document.getElementById("propTelefone");
    if (telInput)
      telInput.addEventListener("input", (e) => this.mascaraTelefone(e));

    ["custoValor", "mensalidadeValor", "custoPropValor", "ranchoValor"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", (e) => this.mascaraMoeda(e));
      },
    );

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
      .getElementById("formMensalidade")
      .addEventListener("submit", (e) => this.salvarMensalidade(e));
    document
      .getElementById("formCusto")
      .addEventListener("submit", (e) => this.salvarCusto(e));
    document
      .getElementById("formCustoProp")
      .addEventListener("submit", (e) => this.salvarCustoProp(e));

    document
      .getElementById("formCustoRancho")
      .addEventListener("submit", (e) => this.salvarCustoRancho(e));

    document
      .getElementById("inputBusca")
      .addEventListener("keyup", (e) => this.filtrarTabela(e.target.value));

    // ATUALIZADO: Agora atualiza também a tabela Rancho ao mudar a ordenação
    document.getElementById("inputOrdenacao").addEventListener("change", () => {
      if (this.abaAtual === "cavalos") this.carregarTabelaCavalos();
      else if (this.abaAtual === "proprietarios")
        this.carregarTabelaProprietarios();
      else if (this.abaAtual === "rancho") this.carregarDespesasRancho();
    });

    document.getElementById("custoCat").addEventListener("change", (e) => {
      const cat = e.target.value;
      const descInput = document.getElementById("custoDesc");
      const exigeDescricao = ["Frete", "Medicamento", "Outros"];

      if (exigeDescricao.includes(cat)) {
        descInput.setAttribute("required", "true");
        descInput.placeholder = `Descreva o ${cat} (Obrigatório)`;
        descInput.value = "";
        descInput.focus();
      } else {
        descInput.removeAttribute("required");
        descInput.placeholder = "Opcional (Exames/Ferradura)";
      }
    });

    document
      .getElementById("logoutButton")
      .addEventListener("click", async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {}
        localStorage.removeItem("token");
        window.location.href = "login.html";
      });
  },

  // --- PWA ---
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
        document.getElementById("btnInstalarApp").classList.add("d-none");
      this.deferredPrompt = null;
    }
  },

  // --- NAVEGAÇÃO ---
  mudarAba(aba) {
    this.vibrar(30);
    this.abaAtual = aba;

    const tabCavalos = document.getElementById("tabCavalos");
    const tabProps = document.getElementById("tabProprietarios");
    const tabRancho = document.getElementById("tabRancho");
    const titulo = document.getElementById("tituloSecao");

    tabCavalos.classList.add("d-none");
    tabProps.classList.add("d-none");
    tabRancho.classList.add("d-none");
    document.getElementById("navBtnCavalos").classList.remove("active");
    document.getElementById("navBtnProps").classList.remove("active");
    document.getElementById("navBtnRancho").classList.remove("active");

    if (aba === "cavalos") {
      tabCavalos.classList.remove("d-none");
      titulo.textContent = "Meus Animais";
      document.getElementById("navBtnCavalos").classList.add("active");
      this.carregarTabelaCavalos();
    } else if (aba === "proprietarios") {
      tabProps.classList.remove("d-none");
      titulo.textContent = "Meus Clientes";
      document.getElementById("navBtnProps").classList.add("active");
      this.carregarTabelaProprietarios();
    } else if (aba === "rancho") {
      tabRancho.classList.remove("d-none");
      titulo.textContent = "Despesas do Rancho";
      document.getElementById("navBtnRancho").classList.add("active");
      this.dataFiltroRancho = new Date();
      this.atualizarLabelMesRancho();
      this.carregarDespesasRancho();
    }

    document.getElementById("inputBusca").value = "";
    this.filtrarTabela("");
  },

  filtrarTabela(termo) {
    let s = "";
    if (this.abaAtual === "cavalos") s = "#listaCavalosBody tr";
    else if (this.abaAtual === "proprietarios")
      s = "#listaProprietariosMainBody tr";
    else if (this.abaAtual === "rancho") s = "#listaRanchoBody tr";

    document.querySelectorAll(s).forEach((r) => {
      r.style.display = r.textContent
        .toLowerCase()
        .includes(termo.toLowerCase())
        ? ""
        : "none";
    });
  },

  adicionarItemAtual() {
    this.vibrar();
    if (this.abaAtual === "cavalos") this.abrirModalNovoCavalo();
    else if (this.abaAtual === "proprietarios")
      this.abrirModalGerenciarProprietarios();
    else if (this.abaAtual === "rancho") {
      document.getElementById("ranchoDesc").focus();
    }
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

  // --- GESTÃO RANCHO (ATUALIZADA) ---

  async carregarDespesasRancho() {
    const mes = this.dataFiltroRancho.getMonth() + 1;
    const ano = this.dataFiltroRancho.getFullYear();
    const ordem = document.getElementById("inputOrdenacao").value;
    const tbody = document.getElementById("listaRanchoBody");
    tbody.innerHTML =
      '<tr><td colspan="2" class="text-center py-4"><span class="spinner-border spinner-border-sm text-secondary"></span></td></tr>';

    try {
      const dados = await ApiService.fetchData(
        `/api/gestao/custos/rancho?mes=${mes}&ano=${ano}`,
      );
      tbody.innerHTML = "";

      const icones = {
        Alimentação: "fa-wheat",
        Manutenção: "fa-hammer",
        Funcionários: "fa-user-clock",
        Energia: "fa-bolt",
        Outros: "fa-circle-question",
        Rancho: "fa-file-invoice-dollar",
      };

      if (dados && dados.custos && dados.custos.length > 0) {
        document.getElementById("areaGraficoRancho").style.display = "block";
        this.renderizarGraficoRancho(dados.custos);

        const listaProcessada = dados.custos.map((c) => ({
          ...c,
          nome: c.descricao,
          totalSort: parseFloat(c.valor),
        }));

        const listaOrdenada = this.ordenarLista(listaProcessada, ordem);

        listaOrdenada.forEach((c) => {
          const dia = new Date(c.data_despesa).getDate();
          const valorF = parseFloat(c.valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          const icone = icones[c.categoria] || icones["Outros"];
          // Mostra a quantidade se for maior que 1 ou se existir
          const qtd =
            c.quantidade && c.quantidade > 1 ? `${c.quantidade}x ` : "";

          tbody.innerHTML += `
            <tr class="border-bottom">
              <td class="py-3 ps-3">
                 <div class="d-flex align-items-center">
                    <div class="avatar-circle shadow-sm me-3" style="background: rgba(139, 69, 19, 0.1); color: #8b4513; width: 40px; height: 40px;">
                       <i class="fa-solid ${icone}"></i>
                    </div>
                    <div>
                       <div class="fw-bold text-dark"><span class="fw-bold text-primary">${qtd}</span>${c.descricao}</div>
                       <div class="text-muted small">${c.categoria} • Dia ${dia}</div>
                    </div>
                 </div>
              </td>
              <td class="text-end pe-3">
                 <div class="d-flex align-items-center justify-content-end gap-3">
                    <span class="fw-bold text-danger">${valorF}</span>
                    <button class="btn-action icon-red shadow-sm" onclick="RanchoApp.excluirCustoRancho(${c.id})">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
                    </button>
                 </div>
              </td>
            </tr>`;
        });

        const totalFormatado = parseFloat(dados.total_gasto).toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" },
        );
        document.getElementById("totalRanchoMesDisplay").textContent =
          totalFormatado;
        document.getElementById("totalRanchoMes").textContent = totalFormatado;
      } else {
        document.getElementById("areaGraficoRancho").style.display = "none";
        tbody.innerHTML = `
          <tr>
            <td colspan="2" class="text-center border-0 py-5">
              <div class="opacity-25 mb-2">
                <i class="fa-solid fa-clipboard-check display-3 text-secondary"></i>
              </div>
              <p class="text-muted fw-bold mb-0">Tudo tranquilo!</p>
              <small class="text-muted">Nenhuma despesa lançada.</small>
            </td>
          </tr>`;
        document.getElementById("totalRanchoMesDisplay").textContent =
          "R$ 0,00";
        document.getElementById("totalRanchoMes").textContent = "R$ 0,00";
      }
    } catch (e) {
      console.error(e);
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-danger small">Erro ao carregar dados.</td></tr>';
    }
  },

  renderizarGraficoRancho(custos) {
    const ctx = document.getElementById("graficoRancho");
    const dados = {};
    custos.forEach((c) => {
      const cat = c.categoria || "Outros";
      if (!dados[cat]) dados[cat] = 0;
      dados[cat] += parseFloat(c.valor);
    });

    if (this.chartRanchoInstance) this.chartRanchoInstance.destroy();

    this.chartRanchoInstance = new Chart(ctx, {
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
              boxWidth: 12,
              font: { size: 11, family: "'Segoe UI', sans-serif" },
            },
          },
        },
        layout: {
          padding: 10,
        },
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
    document.getElementById("labelMesAnoRancho").textContent =
      this.dataFiltroRancho
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .toUpperCase();
  },

  async salvarCustoRancho(e) {
    e.preventDefault();
    const btn = e.submitter;
    this.setLoading(btn, true, '<i class="fa-solid fa-plus"></i>');

    const cat = document.getElementById("ranchoCat").value;
    const qtd = document.getElementById("ranchoQtd").value; // NOVO

    const body = {
      proprietario_id: null,
      cavalo_id: null,
      descricao: document.getElementById("ranchoDesc").value,
      valor: this.limparMoeda(document.getElementById("ranchoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
      categoria: cat || "Rancho",
      quantidade: qtd ? parseInt(qtd) : 1, // Envia quantidade
    };

    try {
      await ApiService.postData("/api/gestao/custos", body);
      this.mostrarNotificacao("Adicionado!");
      document.getElementById("formCustoRancho").reset();
      this.carregarDespesasRancho();
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

  // --- FIM GESTÃO RANCHO ---

  async carregarTabelaCavalos() {
    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const tbody = document.getElementById("listaCavalosBody");
      tbody.innerHTML = "";
      document.getElementById("totalCavalos").textContent = cavalos
        ? cavalos.length
        : 0;

      if (!cavalos || cavalos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 border-0"><div class="mb-3 opacity-25"><i class="fa-solid fa-horse-head display-1 text-secondary"></i></div><h6 class="text-muted fw-bold">Nenhum animal</h6><button class="btn btn-primary rounded-pill mt-2" onclick="RanchoApp.abrirModalNovoCavalo()">Cadastrar</button></td></tr>`;
        return;
      }

      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();
      const ordem = document.getElementById("inputOrdenacao").value;

      const listaProcessada = await Promise.all(
        cavalos.map(async (cavalo) => {
          const dadosFin = await ApiService.fetchData(
            `/api/gestao/custos/resumo/${cavalo.id}?mes=${mesAtual}&ano=${anoAtual}`,
          );
          return {
            ...cavalo,
            totalSort: parseFloat(dadosFin.total_gasto || 0),
            totalFormatado: parseFloat(
              dadosFin.total_gasto || 0,
            ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          };
        }),
      );

      const listaOrdenada = this.ordenarLista(listaProcessada, ordem);

      listaOrdenada.forEach((cavalo) => {
        const ns = cavalo.nome.replace(/'/g, "\\'");
        let avatarHtml = `<div class="avatar-circle avatar-cavalo shadow-sm">${cavalo.nome
          .charAt(0)
          .toUpperCase()}</div>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
                <td class="nome-clicavel" onclick="RanchoApp.abrirModalEditar(${
                  cavalo.id
                }, '${ns}', '${(cavalo.lugar || "").replace(
                  /'/g,
                  "\\'",
                )}', '${cavalo.proprietario_id || ""}', '${(
                  cavalo.observacoes || ""
                ).replace(/'/g, "\\'")}')">
                    <div class="d-flex align-items-center gap-3">
                        ${avatarHtml}
                        <div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${
                          cavalo.nome
                        }</div><div class="text-muted small"><i class="fa-solid fa-location-dot me-1"></i> ${
                          cavalo.lugar || "Sem local"
                        }</div></div>
                    </div>
                </td>
                <td class="d-none d-md-table-cell text-muted"><i class="fa-solid fa-user me-1"></i> ${
                  cavalo.nome_proprietario || "Sem dono"
                }</td>
                <td class="text-nowrap"><div class="d-flex flex-column align-items-end align-items-md-start"><span class="d-md-none small-label mb-1">Gasto Mês</span><span class="text-danger fw-bold bg-soft-danger px-2 py-1 rounded-3">${
                  cavalo.totalFormatado
                }</span></div></td>
                <td class="text-end">
                    <button class="btn-action btn-light text-primary me-2 shadow-sm" onclick="event.stopPropagation();RanchoApp.abrirMensalidade(${
                      cavalo.id
                    },'${ns}')"><i class="fa-solid fa-calendar-plus"></i></button>
                    <button class="btn-action icon-gold shadow-sm" onclick="event.stopPropagation();RanchoApp.abrirFinanceiro(${
                      cavalo.id
                    },'${ns}')"><i class="fa-solid fa-coins"></i></button>
                </td>`;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error(error);
    }
  },

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
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-5 border-0"><div class="mb-3 opacity-25"><i class="fa-solid fa-users display-1 text-secondary"></i></div><h6 class="text-muted fw-bold">Sem clientes</h6><button class="btn btn-secondary rounded-pill mt-2" onclick="RanchoApp.abrirModalGerenciarProprietarios()">Novo Cliente</button></td></tr>`;
        return;
      }

      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();
      const ordem = document.getElementById("inputOrdenacao").value;

      const listaProcessada = await Promise.all(
        props.map(async (p) => {
          const meusCavalos = cavalos.filter((c) => c.proprietario_id == p.id);
          const txt =
            meusCavalos.length === 1
              ? "1 animal"
              : `${meusCavalos.length} animais`;

          let totalDivida = 0;
          for (const cavalo of meusCavalos) {
            const resumo = await ApiService.fetchData(
              `/api/gestao/custos/resumo/${cavalo.id}?mes=${mesAtual}&ano=${anoAtual}`,
            );
            if (resumo.custos)
              resumo.custos.forEach((c) => {
                if (!c.pago) totalDivida += parseFloat(c.valor);
              });
          }
          const diretos = await ApiService.fetchData(
            `/api/gestao/custos/diretos/${p.id}?mes=${mesAtual}&ano=${anoAtual}`,
          );
          if (diretos)
            diretos.forEach((c) => {
              if (!c.pago) totalDivida += parseFloat(c.valor);
            });

          return {
            ...p,
            totalSort: totalDivida,
            txtAnimais: txt,
            txtValor:
              totalDivida > 0
                ? totalDivida.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "Pago",
            badgeClass:
              totalDivida > 0
                ? "bg-soft-danger text-danger"
                : "bg-soft-success text-success",
          };
        }),
      );

      const listaOrdenada = this.ordenarLista(listaProcessada, ordem);

      listaOrdenada.forEach((p) => {
        let avatarHtml = `<div class="avatar-circle avatar-dono shadow-sm">${p.nome
          .charAt(0)
          .toUpperCase()}</div>`;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <tr>
            <td class="nome-clicavel" onclick="RanchoApp.abrirDetalhesProprietario(${
              p.id
            },'${p.nome}','${p.telefone || ""}')">
                <div class="d-flex align-items-center gap-3">
                    ${avatarHtml}
                    <div><div class="fw-bold text-dark">${
                      p.nome
                    }</div><div class="text-primary small fw-bold"><i class="fa-solid fa-horse-head me-1"></i> ${
                      p.txtAnimais
                    }</div></div>
                </div>
            </td>
            <td class="d-none d-md-table-cell text-muted"><i class="fa-solid fa-phone me-1"></i> ${
              p.telefone || "-"
            }</td>
            <td class="text-end">
                <div class="d-flex align-items-center justify-content-end gap-3">
                    <span class="badge-status ${p.badgeClass}">${
                      p.txtValor
                    }</span>
                    <button class="btn-action icon-brown shadow-sm btn-edit" onclick="event.stopPropagation(); RanchoApp.abrirModalGerenciarProprietarios(${
                      p.id
                    }, '${p.nome}', '${
                      p.telefone
                    }')"><i class="fa-solid fa-pen"></i></button>
                </div>
            </td>
            </tr>`;
        tbody.appendChild(tr);
      });
    } catch (err) {}
  },

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

    const descInput = document.getElementById("custoDesc");
    descInput.removeAttribute("required");
    descInput.placeholder = "Descrição";

    this.dataFiltro = new Date();
    this.atualizarLabelMes();
    this.bsModalFin.show();
    this.carregarListaCustos(cavaloId);
  },

  prepararEdicaoCusto(id, desc, cat, valor) {
    this.vibrar();
    document.getElementById("custoIdEdit").value = id;
    const descInput = document.getElementById("custoDesc");
    descInput.value = desc;
    const catSelect = document.getElementById("custoCat");
    catSelect.value = cat;
    catSelect.dispatchEvent(new Event("change"));
    document.getElementById("custoValor").value = parseFloat(
      valor,
    ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const btn = document.getElementById("btnSalvarCusto");
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    btn.classList.replace("btn-success", "btn-warning");
    descInput.focus();
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

    if (!descricao || descricao.trim() === "") {
      descricao = cat;
    }

    const body = {
      cavalo_id: cavaloId,
      proprietario_id: null,
      descricao: descricao,
      categoria: cat,
      valor: this.limparMoeda(document.getElementById("custoValor").value),
      data_despesa: new Date().toISOString().split("T")[0],
    };

    try {
      const cavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const cavalo = cavalos.find((c) => c.id == cavaloId);
      if (cavalo) body.proprietario_id = cavalo.proprietario_id;

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

        let acoes = "";
        if (c.is_mensalidade) {
          acoes = c.pago
            ? '<span class="badge-status bg-soft-success"><i class="fa-solid fa-check"></i></span>'
            : '<span class="badge-status bg-soft-danger"><i class="fa-solid fa-clock"></i></span>';
        } else {
          acoes = `<button class="btn-action icon-brown shadow-sm me-1" style="width:32px; height:32px" onclick="RanchoApp.prepararEdicaoCusto(${c.id}, '${c.descricao.replace(/'/g, "\\'")}', '${c.categoria}', ${c.valor})"><i class="fa-solid fa-pen" style="font-size:0.8rem"></i></button><button class="btn-action icon-red shadow-sm" style="width:32px; height:32px" onclick="RanchoApp.excluirCusto(${c.id}, ${cavaloId})"><i class="fa-solid fa-trash" style="font-size:0.8rem"></i></button>`;
        }

        tbody.innerHTML += `<tr class="border-bottom"><td class="py-3"><div class="d-flex align-items-center"><div class="date-badge me-3 text-center rounded-3 bg-light p-1 border" style="min-width: 45px;"><div class="fw-bold fs-5 lh-1">${dia}</div><div class="small text-muted" style="font-size: 0.65rem;">${mesNome}</div></div><div><div class="fw-bold text-dark text-truncate" style="max-width: 160px;">${c.descricao}</div><div class="text-muted small">${c.categoria}</div></div></div></td><td class="text-end py-3"><div class="fw-bold text-danger mb-1">${valorF}</div><div class="d-flex justify-content-end">${acoes}</div></td></tr>`;
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

  abrirModalNovoCavalo() {
    this.vibrar();
    document.getElementById("formCavalo").reset();
    document.getElementById("cavaloId").value = "";
    this.bsModalCavalo.show();
  },
  abrirModalEditar(id, n, l, p, o) {
    this.vibrar();
    document.getElementById("cavaloId").value = id;
    document.getElementById("cavaloNome").value = n;
    document.getElementById("cavaloLugar").value = l;
    document.getElementById("cavaloProprietario").value = p;
    document.getElementById("cavaloObs").value = o;
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
  abrirModalConfig() {
    this.bsModalConfig.show();
  },
  async salvarConfig(e) {
    e.preventDefault();
    try {
      await ApiService.putData("/api/gestao/config", {
        nome_rancho: document.getElementById("configNomeRancho").value,
      });
      this.carregarConfiguracoes();
      this.bsModalConfig.hide();
      this.mostrarNotificacao("Salvo!");
    } catch (e) {}
  },
  async carregarConfiguracoes() {
    try {
      const r = await ApiService.fetchData("/api/gestao/config");
      if (r && r.nome_rancho) {
        document.getElementById("brandName").textContent = r.nome_rancho;
        document.title = r.nome_rancho;
      }
    } catch (e) {}
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

  async abrirMensalidade(cavaloId, nomeCavalo) {
    this.vibrar();
    document.getElementById("mensalidadeCavaloId").value = cavaloId;
    document.getElementById("tituloModalMensalidade").textContent =
      `Mensalidade: ${nomeCavalo}`;
    document.getElementById("formMensalidade").reset();
    if (document.getElementById("checkBaia"))
      document.getElementById("checkBaia").checked = true;
    if (document.getElementById("checkAlimentacao"))
      document.getElementById("checkAlimentacao").checked = true;
    if (document.getElementById("checkPiquete"))
      document.getElementById("checkPiquete").checked = false;
    if (document.getElementById("checkTreino"))
      document.getElementById("checkTreino").checked = false;
    const campoData = document.getElementById("mensalidadeData");
    if (campoData) {
      const divPai = campoData.closest(".col-6");
      if (divPai) divPai.style.display = "none";
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
    const itensSelecionados = [];
    if (document.getElementById("checkBaia").checked)
      itensSelecionados.push("Baia");
    if (document.getElementById("checkPiquete").checked)
      itensSelecionados.push("Piquete");
    if (document.getElementById("checkTreino").checked)
      itensSelecionados.push("Treino");
    if (document.getElementById("checkAlimentacao").checked)
      itensSelecionados.push("Alimentação");
    const body = {
      cavalo_id: document.getElementById("mensalidadeCavaloId").value,
      mes: document.getElementById("mensalidadeMes").value,
      ano: document.getElementById("mensalidadeAno").value,
      valor: this.limparMoeda(
        document.getElementById("mensalidadeValor").value,
      ),
      itens: itensSelecionados.join(", "),
    };
    try {
      await ApiService.postData("/api/gestao/mensalidades", body);
      this.mostrarNotificacao("Mensalidade adicionada!");
      this.carregarMensalidades(body.cavalo_id);
    } catch (err) {
      if (err.message && err.message.includes("409"))
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
    const nomesMeses = [
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
    if (lista && lista.length) {
      lista.forEach((m) => {
        const valorF = parseFloat(m.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const badge = m.pago
          ? '<span class="badge-status bg-soft-success"><i class="fa-solid fa-check"></i> Pago</span>'
          : '<span class="badge-status bg-soft-danger"><i class="fa-solid fa-clock"></i> Pendente</span>';
        const itens = m.itens
          ? `<div class="text-muted small mt-1"><i class="fa-solid fa-list-ul me-1"></i> ${m.itens}</div>`
          : "";
        tbody.innerHTML += `
            <tr class="border-bottom">
                <td class="py-3 ps-3">
                    <div class="fw-bold text-dark">${nomesMeses[m.mes]} / ${
                      m.ano
                    }</div>
                    ${itens}
                    <div class="mt-2">${badge}</div>
                </td>
                <td class="text-end pe-3">
                    <div class="fw-bold text-secondary mb-2">${valorF}</div>
                    <button class="btn-action icon-red shadow-sm btn-sm" style="width:32px; height:32px" onclick="RanchoApp.excluirMensalidade(${
                      m.id
                    }, ${cavaloId})"><i class="fa-solid fa-trash" style="font-size:0.8rem"></i></button>
                </td>
            </tr>`;
      });
    } else {
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted py-4">Nenhuma mensalidade lançada.</td></tr>';
    }
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
      this.abrirConfirmacao("Excluir", "Apagar?", async () => {
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
      this.abrirConfirmacao("Excluir", "Apagar?", async () => {
        await ApiService.deleteData(`/api/gestao/proprietarios/${id}`);
        this.bsModalProp.hide();
        this.carregarTabelaProprietarios();
        this.carregarProprietariosSelect();
      });
  },

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
    document.getElementById("labelMesAnoProp").textContent = this.dataFiltroProp
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
    this.abrirConfirmacao("Baixar", "Confirmar?", async () => {
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
      '<tr><td colspan="2" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';
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
          '<tr><td colspan="2" class="text-center text-muted py-5"><i class="fa-regular fa-folder-open display-4 opacity-25 mb-2"></i><br>Fatura zerada.</td></tr>';
        document.getElementById("totalGeralProp").textContent = "R$ 0,00";
        document.getElementById("acoesFatura").classList.add("d-none");
        return;
      }
      document.getElementById("acoesFatura").classList.remove("d-none");
      let pendente = 0;
      let html = "";
      lista.forEach((item) => {
        const valorF = item.custo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        let acao = "";
        let iconeStatus = item.pago
          ? '<i class="fa-solid fa-check-circle text-success me-2"></i>'
          : '<i class="fa-regular fa-circle text-muted me-2"></i>';
        if (!item.pago) {
          pendente += item.custo;
          if (item.tipo === "direto")
            acao = `<button class="btn btn-sm text-danger ms-2 p-0" onclick="RanchoApp.excluirCustoDireto(${item.id})"><i class="fa-solid fa-times"></i></button>`;
        }
        html += `<tr class="border-bottom"><td class="py-3 text-start"><div class="${
          item.pago
            ? "text-success text-decoration-line-through opacity-75"
            : "text-dark fw-bold"
        }">${iconeStatus}${item.nome}</div></td><td class="text-end py-3"><span class="${
          item.pago ? "text-success opacity-75" : "text-dark fw-bold"
        }">${valorF}</span>${acao}</td></tr>`;
      });
      tbody.innerHTML = html;
      const btnBaixar = document.getElementById("btnBaixarFatura");
      const btnZap = document.getElementById("btnZapCobranca");
      if (pendente > 0) {
        document.getElementById("totalGeralProp").innerHTML =
          `<span class="text-danger">${pendente.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}</span>`;
        btnBaixar.disabled = false;
        btnBaixar.innerHTML =
          '<i class="fa-solid fa-check-circle me-2"></i> Confirmar Pagamento';
        btnBaixar.className =
          "btn btn-primary py-3 rounded-4 fw-bold shadow-sm";
      } else {
        document.getElementById("totalGeralProp").innerHTML =
          '<span class="text-success"><i class="fa-solid fa-check-double me-2"></i>Pago</span>';
        btnBaixar.disabled = true;
        btnBaixar.className =
          "btn btn-success py-3 rounded-4 fw-bold shadow-sm opacity-50";
        btnBaixar.innerHTML = "Fatura Quitada";
      }
      const cleanTel = telefoneProp.replace(/\D/g, "");
      const novoBtnZap = btnZap.cloneNode(true);
      btnZap.parentNode.replaceChild(novoBtnZap, btnZap);
      novoBtnZap.onclick = () => {
        const totalTexto =
          pendente > 0
            ? pendente.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "QUITADO";
        this.compartilharFaturaZap(propId, nomeProp, totalTexto, cleanTel);
      };
    } catch (err) {
      console.error(err);
    }
  },
  async compartilharFaturaZap(propId, nomeProp, totalTexto, telefone) {
    this.mostrarNotificacao("Gerando texto...", "sucesso");
    const periodo = document.getElementById("labelMesAnoProp").textContent;
    const mes = this.dataFiltroProp.getMonth() + 1;
    const ano = this.dataFiltroProp.getFullYear();
    let msg = `Ola *${nomeProp}*.\nSegue o fechamento de *${periodo}*:\n\n`;
    try {
      const allCavalos = await ApiService.fetchData("/api/gestao/cavalos");
      const meusCavalos = allCavalos.filter((c) => c.proprietario_id == propId);
      for (const cavalo of meusCavalos) {
        const dados = await ApiService.fetchData(
          `/api/gestao/custos/resumo/${cavalo.id}?mes=${mes}&ano=${ano}`,
        );
        let subtotal = 0;
        if (dados.custos)
          dados.custos.forEach((c) => (subtotal += parseFloat(c.valor)));
        if (subtotal > 0)
          msg += `*${cavalo.nome}*: ${subtotal.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n`;
      }
      const diretos = await ApiService.fetchData(
        `/api/gestao/custos/diretos/${propId}?mes=${mes}&ano=${ano}`,
      );
      if (diretos) {
        diretos.forEach((c) => {
          const valorF = parseFloat(c.valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          msg += `${c.descricao} (Avulso): ${valorF}\n`;
        });
      }
      msg += `\n*TOTAL: ${totalTexto}*`;
      const cleanTel = telefone.replace(/\D/g, "");
      const url = `https://wa.me/55${cleanTel}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      this.mostrarNotificacao("Erro ao gerar Zap.", "erro");
    }
  },
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
      `TOTAL GERAL: ${total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}`,
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
  vibrar(ms = 50) {
    if (navigator.vibrate) navigator.vibrate(ms);
  },
  mascaraTelefone(e) {
    let v = e.target.value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = v;
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
    const tm = document.getElementById("toastMessage");
    const te = document.getElementById("liveToast");
    tm.innerHTML = msg;
    te.className = `toast align-items-center border-0 ${
      tipo === "erro" ? "text-bg-danger" : "text-bg-success"
    }`;
    if (this.bsToast) this.bsToast.show();
    if (tipo === "erro") this.vibrar([50, 50, 50]);
    else this.vibrar(100);
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

document.addEventListener("DOMContentLoaded", () => {
  RanchoApp.init();
});
