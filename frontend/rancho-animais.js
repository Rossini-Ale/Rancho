// ── Animais / Ficha Veterinária ───────────────────────────────
Object.assign(RanchoApp, {
  async carregarTabelaCavalos() {
    const mapa = document.getElementById("mapaOcupacao");
    if (!mapa) return;
    const cached = this._cacheGet("ocupacao");
    if (!cached) mapa.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;
    try {
      const dados = cached ?? await ApiService.fetchData("/api/dashboard/ocupacao").then((r) => { this._cacheSet("ocupacao", r); return r; });
      if (!dados) return;
      this._dadosAnimais = dados;
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

    const busca = (document.getElementById("buscaAnimais")?.value || "").toLowerCase().trim();
    const ordem = document.getElementById("ordenarAnimais")?.value || "nome";

    const el = (id) => document.getElementById(id);
    if (el("ocupTotal")) el("ocupTotal").textContent = dados.stats.totalOcupados;
    if (el("ocupSemLocal")) el("ocupSemLocal").textContent = dados.stats.totalSemLocal;
    if (el("ocupTaxa")) el("ocupTaxa").textContent = `${dados.stats.taxaOcupacao}%`;
    if (el("ocupPctLabel")) el("ocupPctLabel").textContent = `${dados.stats.taxaOcupacao}%`;
    if (el("ocupBarra")) el("ocupBarra").style.width = `${dados.stats.taxaOcupacao}%`;
    const taxaEl = el("ocupTaxa");
    if (taxaEl)
      taxaEl.style.color = dados.stats.taxaOcupacao >= 70 ? "var(--verde)" : dados.stats.taxaOcupacao >= 40 ? "var(--dourado)" : "var(--vermelho)";
    const labelEl = el("ocupLabel");
    if (labelEl)
      labelEl.textContent = `${dados.stats.totalOcupados} ${dados.stats.totalOcupados !== 1 ? "animais" : "animal"} com local${dados.stats.totalSemLocal > 0 ? ` · ${dados.stats.totalSemLocal} sem local` : ""}`;

    let todosAnimais = [];
    dados.grupos.forEach((g) =>
      g.slots.forEach((s) => {
        if (s.animais?.length) todosAnimais.push({ ...s.animais[0], _local: s.nome, _grupo: g.local });
      }),
    );
    dados.semLocal?.forEach((a) => todosAnimais.push({ ...a, _local: "", _grupo: "Sem local" }));

    if (busca) {
      todosAnimais = todosAnimais.filter(
        (a) => a.nome?.toLowerCase().includes(busca) || a.proprietario?.toLowerCase().includes(busca) || a._local?.toLowerCase().includes(busca),
      );
    }

    todosAnimais.sort((a, b) => {
      if (ordem === "local") return (a._local || "zzz").localeCompare(b._local || "zzz");
      if (ordem === "proprietario") return (a.proprietario || "zzz").localeCompare(b.proprietario || "zzz");
      return a.nome.localeCompare(b.nome);
    });

    if (!todosAnimais.length) {
      mapa.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);font-size:0.85rem;">Nenhum animal encontrado.</div>`;
      return;
    }

    if (busca || ordem !== "nome") {
      mapa.innerHTML = `<div style="padding:0 14px 12px;">${todosAnimais.map((a) => {
        const ns = a.nome.replace(/'/g, "\\'");
        const ls = (a._local || "").replace(/'/g, "\\'");
        const os = (a.observacoes || "").replace(/'/g, "\\'");
        const pid = a.proprietario_id || "";
        const pend = a.tem_pendente;
        const totalF = a.total_mes > 0 ? a.total_mes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
        const bordaClr = a._local === "" ? "#C49A4A" : pend ? "#E53935" : "#3D7A5E";
        const statusTxt = a._local === "" ? "Sem local" : pend && totalF ? `${totalF} pendente` : pend ? "Pendente" : "Em dia";
        const statusClr = a._local === "" ? "#C49A4A" : pend ? "#A83232" : "#3D7A5E";
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
      }).join("")}</div>`;
      return;
    }

    let html = '<div style="padding:0 14px 12px;">';
    if (dados.semLocal && dados.semLocal.length > 0) {
      html += `
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.7px;color:#C49A4A;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:0.65rem;"></i> Sem local atribuído
        </div>
        ${dados.semLocal.map((a) => this._cardSemLocal(a)).join("")}
        <div style="height:0.5px;background:var(--bege-borda);margin:8px 0 12px;"></div>`;
    }
    dados.grupos.forEach((grupo) => {
      html += `
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.7px;color:var(--texto-suave);font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
          <span>${grupo.tipo}</span>
          <span style="background:var(--bege-fundo);border:0.5px solid var(--bege-borda);border-radius:6px;padding:1px 8px;font-size:0.65rem;">${grupo.ocupados} ocupado${grupo.ocupados !== 1 ? "s" : ""}</span>
        </div>
        ${grupo.slots.map((slot) => this._cardOcupado(slot)).join("")}
        <div style="height:0.5px;background:var(--bege-borda);margin:4px 0 12px;"></div>`;
    });
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

  filtrarAnimais() { this._renderAnimais(); },

  _cardOcupado(slot) {
    const animal = slot.animais[0];
    const ns = animal.nome.replace(/'/g, "\\'");
    const ls = slot.nome.replace(/'/g, "\\'");
    const os = (animal.observacoes || "").replace(/'/g, "\\'");
    const pid = animal.proprietario_id || "";
    const pend = animal.tem_pendente;
    const totalF = animal.total_mes > 0 ? animal.total_mes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
    const bordaClr = pend ? "#E53935" : "#3D7A5E";
    const statusTxt = pend && totalF ? `${totalF} pendente` : pend ? "Pendente" : "Em dia";
    const statusClr = pend ? "#A83232" : "#3D7A5E";
    return `
      <div onclick="RanchoApp.abrirAcoesAnimal(${animal.id},'${ns}','${ls}','${pid}','${os}')"
        style="background:var(--bege-card);border:0.5px solid var(--bege-borda);border-radius:13px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:7px;position:relative;overflow:hidden;box-shadow:var(--sombra);">
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${bordaClr};border-radius:3px 0 0 3px;"></div>
        <div style="width:38px;height:38px;border-radius:11px;background:#3D7A5E;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:600;flex-shrink:0;margin-left:4px;">${animal.nome.charAt(0).toUpperCase()}</div>
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
        <div style="width:38px;height:38px;border-radius:11px;background:rgba(196,154,74,0.18);display:flex;align-items:center;justify-content:center;color:#8B5230;font-size:14px;font-weight:600;flex-shrink:0;margin-left:4px;">${animal.nome.charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.7rem;color:#C49A4A;font-weight:600;margin-bottom:1px;display:flex;align-items:center;gap:4px;"><i class="fa-solid fa-triangle-exclamation" style="font-size:0.65rem;"></i> Sem local atribuído</div>
          <div style="font-size:0.88rem;font-weight:600;color:var(--texto-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.nome}</div>
          <div style="font-size:0.75rem;color:var(--texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${animal.proprietario || "Sem proprietário"}</div>
        </div>
        <i class="fa-solid fa-chevron-right" style="font-size:0.65rem;color:var(--bege-borda);flex-shrink:0;"></i>
      </div>`;
  },

  abrirAcoesAnimal(id, nome, lugar, propId, obs) {
    this.vibrar();
    const modal = document.getElementById("modalAcoesAnimal");
    if (!modal) return;
    document.getElementById("acoesAnimalNome").textContent = nome;
    document.getElementById("acoesAnimalLocal").textContent = lugar || "Sem local";

    const btnLigar = document.getElementById("btnAcaoLigar");
    const telLabel = document.getElementById("acoesAnimalTelefone");
    if (btnLigar) {
      btnLigar.style.display = "none";
      if (propId) {
        const buscarTel = async () => {
          try {
            const props = await ApiService.fetchData("/api/gestao/proprietarios");
            const prop = (props || []).find((p) => String(p.id) === String(propId));
            if (prop?.telefone) {
              const telLimpo = prop.telefone.replace(/\D/g, "");
              if (telLabel) telLabel.textContent = prop.telefone;
              btnLigar.style.display = "flex";
              btnLigar.onclick = () => {
                this.bsModalAcoesAnimal.hide();
                setTimeout(() => { window.location.href = `tel:+55${telLimpo}`; }, 300);
              };
            }
          } catch (e) {}
        };
        buscarTel();
      }
    }

    document.getElementById("btnAcaoEditar").onclick = () => { this.bsModalAcoesAnimal.hide(); this.abrirModalEditar(id, nome, lugar, propId, obs); };
    document.getElementById("btnAcaoCusto").onclick = () => { this.bsModalAcoesAnimal.hide(); setTimeout(() => this.abrirFinanceiro(id, nome), 350); };
    document.getElementById("btnAcaoMensalidade").onclick = () => { this.bsModalAcoesAnimal.hide(); setTimeout(() => this.abrirMensalidade(id, nome), 350); };
    document.getElementById("btnAcaoFichaVet").onclick = () => { this.bsModalAcoesAnimal.hide(); setTimeout(() => this.abrirFichaVet(id, nome), 350); };
    document.getElementById("btnAcaoExcluir").onclick = () => {
      this.bsModalAcoesAnimal.hide();
      setTimeout(() => { document.getElementById("cavaloId").value = id; this.excluirCavaloAtual(); }, 350);
    };

    if (!this.bsModalAcoesAnimal) this.bsModalAcoesAnimal = new bootstrap.Modal(modal);
    this.bsModalAcoesAnimal.show();
  },

  abrirModalNovoCavalo(lugarPreenchido = "") {
    this.vibrar();
    document.getElementById("formCavalo").reset();
    document.getElementById("cavaloId").value = "";
    document.getElementById("tituloModalCavalo").textContent = "Novo Animal";
    if (lugarPreenchido) document.getElementById("cavaloLugar").value = lugarPreenchido;
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

  async carregarProprietariosSelect() {
    try {
      const p = await ApiService.fetchData("/api/gestao/proprietarios");
      const s = document.getElementById("cavaloProprietario");
      s.innerHTML = '<option value="">Selecione...</option>';
      if (p) p.forEach((x) => (s.innerHTML += `<option value="${x.id}">${x.nome}</option>`));
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
      this._cacheClear("ocupacao", "kpis", "alertas");
      this.bsModalCavalo.hide();
      await this.carregarTabelaCavalos();
      if (this.abaAtual === "home") this.carregarHome();
      this.mostrarNotificacao("Salvo!");
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("ocupado")) {
        const campoLugar = document.getElementById("cavaloLugar");
        if (campoLugar) {
          campoLugar.style.borderColor = "var(--vermelho)";
          campoLugar.style.boxShadow = "0 0 0 3px rgba(168,50,50,0.15)";
          setTimeout(() => { campoLugar.style.borderColor = ""; campoLugar.style.boxShadow = ""; }, 3000);
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
        this._cacheClear("ocupacao", "kpis", "alertas");
        this.bsModalCavalo.hide();
        this.carregarTabelaCavalos();
      });
  },

  async carregarSugestoesLocais() {
    try {
      const locais = await ApiService.fetchData("/api/gestao/locais");
      const dl = document.getElementById("sugestoesLocais");
      if (!dl || !locais) return;
      dl.innerHTML = locais.map((l) => `<option value="${l}">`).join("");
    } catch (e) {}
  },

  // ── Ficha Veterinária ──
  abrirFichaVet(id, nome) {
    this.vibrar();
    this.animalVetAtual = id;
    document.getElementById("tituloFichaVet").textContent = "Ficha Veterinária";
    document.getElementById("subtituloFichaVet").textContent = nome;
    document.getElementById("vetDataEvento").value = new Date().toISOString().split("T")[0];
    document.getElementById("vetTipo").value = "";
    document.getElementById("vetDescricao").value = "";
    document.getElementById("vetProfissional").value = "";
    document.getElementById("vetProximaData").value = "";
    if (!this.bsModalFichaVet) this.bsModalFichaVet = new bootstrap.Modal(document.getElementById("modalFichaVet"));
    this.bsModalFichaVet.show();
    this.carregarFichaVet(id);
  },

  async carregarFichaVet(cavaloId) {
    const lista = document.getElementById("listaFichaVet");
    if (!lista) return;
    lista.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--texto-suave);font-size:0.85rem;">Carregando...</div>`;
    try {
      const dados = await ApiService.fetchData(`/api/gestao/veterinario/${cavaloId}`);
      if (!dados || !dados.length) {
        lista.innerHTML = `
          <div style="text-align:center;padding:2rem 1rem;">
            <div style="font-size:2.5rem;color:var(--bege-borda);margin-bottom:10px;"><i class="fa-solid fa-stethoscope"></i></div>
            <p style="color:var(--texto-suave);font-size:0.85rem;">Nenhum registro veterinário ainda.</p>
          </div>`;
        return;
      }
      const icones = { Ferradura:"fa-shoe-prints", Vacina:"fa-syringe", Vermifugação:"fa-pills", Consulta:"fa-stethoscope", Exame:"fa-microscope", Outro:"fa-notes-medical" };
      const cores = { Ferradura:"#8B5230", Vacina:"#3D7A5E", Vermifugação:"#7A52A0", Consulta:"#5B8DC9", Exame:"#C49A4A", Outro:"#8A6840" };
      lista.innerHTML = dados.map((r) => {
        const cor = cores[r.tipo] || cores["Outro"];
        const icone = icones[r.tipo] || icones["Outro"];
        const dtEvt = new Date(r.data_evento).toLocaleDateString("pt-BR");
        const dtProx = r.proxima_data ? new Date(r.proxima_data).toLocaleDateString("pt-BR") : null;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const diffDias = r.proxima_data ? Math.ceil((new Date(r.proxima_data) - hoje) / 86400000) : null;
        const alertaProx = diffDias !== null
          ? diffDias < 0 ? `<span style="background:rgba(168,50,50,0.1);color:var(--vermelho);border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;">Vencida</span>`
          : diffDias <= 7 ? `<span style="background:rgba(196,154,74,0.12);color:var(--dourado);border-radius:7px;padding:2px 8px;font-size:0.7rem;font-weight:600;">Vence em ${diffDias}d</span>`
          : `<span style="font-size:0.72rem;color:var(--texto-suave);">Próxima: ${dtProx}</span>` : "";
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
                <button onclick="RanchoApp.excluirFichaVet(${r.id})" style="background:none;border:none;color:var(--texto-suave);cursor:pointer;font-size:0.75rem;margin-top:4px;padding:0;"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`;
      }).join("");
    } catch (e) {}
  },

  async salvarFichaVet() {
    const tipo = document.getElementById("vetTipo").value;
    const dataEvento = document.getElementById("vetDataEvento").value;
    if (!tipo || !dataEvento) { this.mostrarNotificacao("Preencha tipo e data.", "erro"); return; }
    try {
      await ApiService.postData("/api/gestao/veterinario", {
        cavalo_id: this.animalVetAtual,
        tipo,
        descricao: document.getElementById("vetDescricao").value,
        data_evento: dataEvento,
        proxima_data: document.getElementById("vetProximaData").value || null,
        profissional: document.getElementById("vetProfissional").value,
      });
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
});
