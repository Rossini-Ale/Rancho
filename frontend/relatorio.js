// ═══════════════════════════════════════════════════════════
// relatorio.js — Gerador de Relatório Mensal PDF
// Coloque em frontend/relatorio.js
// ═══════════════════════════════════════════════════════════

const Relatorio = {
  // ── Configurações visuais ──
  cores: {
    marrom: [61, 30, 10],
    marromMd: [107, 58, 31],
    dourado: [196, 154, 74],
    bege: [251, 247, 238],
    begeEsc: [221, 195, 138],
    verde: [61, 122, 94],
    vermelho: [168, 50, 50],
    roxo: [122, 82, 160],
    azul: [55, 138, 221],
    texto: [44, 18, 6],
    suave: [138, 104, 64],
  },

  // ── Formata moeda ──
  fmt(valor) {
    return parseFloat(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  },

  // ── Gera o PDF completo ──
  async gerar(mes, ano) {
    if (!window.jspdf) {
      RanchoApp.mostrarNotificacao("Biblioteca PDF não carregada.", "erro");
      return;
    }

    RanchoApp.mostrarNotificacao("Gerando relatório...");

    try {
      // Busca dados do backend
      const dados = await ApiService.fetchData(
        `/api/dashboard/relatorio?mes=${mes}&ano=${ano}`,
      );
      if (!dados) {
        RanchoApp.mostrarNotificacao("Erro ao buscar dados.", "erro");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const W = 210,
        H = 297;
      let y = 0;

      // ════════════════════════════════════════
      // CABEÇALHO
      // ════════════════════════════════════════
      doc.setFillColor(...this.cores.marrom);
      doc.rect(0, 0, W, 42, "F");

      // Faixa dourada no topo
      doc.setFillColor(...this.cores.dourado);
      doc.rect(0, 0, W, 1.5, "F");

      // Logo / ícone decorativo
      doc.setFillColor(...this.cores.marromMd);
      doc.roundedRect(14, 8, 18, 18, 2, 2, "F");
      doc.setTextColor(...this.cores.dourado);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("HF", 23, 20, { align: "center" });

      // Título
      doc.setTextColor(...this.cores.dourado);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(`Relatório Mensal — ${dados.nomeMes} ${dados.ano}`, 36, 17);

      doc.setTextColor(232, 201, 122);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `HF Controll  ·  Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
        36,
        24,
      );

      // KPIs no cabeçalho
      const kpis = [
        {
          label: "Receita",
          valor: this.fmt(dados.kpis.receita.total),
          cor: this.cores.verde,
        },
        {
          label: "Despesas",
          valor: this.fmt(dados.kpis.despesas.total),
          cor: this.cores.vermelho,
        },
        {
          label: "Lucro Líquido",
          valor: this.fmt(dados.kpis.lucro.total),
          cor: this.cores.dourado,
        },
        {
          label: "Pendências",
          valor: this.fmt(dados.kpis.pendencias.total),
          cor: [200, 140, 60],
        },
      ];
      const kpiW = (W - 28) / 4;
      kpis.forEach((k, i) => {
        const x = 14 + i * kpiW;
        doc.setFillColor(255, 255, 255, 0.05);
        doc.setTextColor(232, 201, 122, 0.7);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(k.label.toUpperCase(), x + kpiW / 2, 33, { align: "center" });
        doc.setTextColor(...k.cor);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(k.valor, x + kpiW / 2, 39, { align: "center" });
      });

      y = 52;

      // ════════════════════════════════════════
      // VARIAÇÕES (badges de tendência)
      // ════════════════════════════════════════
      const variacoes = [
        {
          label: "vs mês anterior — Receita",
          pct: dados.kpis.receita.pct,
          positivo: true,
        },
        {
          label: "vs mês anterior — Despesas",
          pct: dados.kpis.despesas.pct,
          positivo: false,
        },
      ];

      variacoes.forEach((v, i) => {
        if (v.pct === null) return;
        const x = 14 + i * 90;
        const sinal = v.pct > 0 ? "+" : "";
        const bom = v.positivo ? v.pct >= 0 : v.pct <= 0;
        const cor = bom ? this.cores.verde : this.cores.vermelho;

        doc.setFillColor(cor[0], cor[1], cor[2], 0.1);
        doc.roundedRect(x, y - 4, 82, 8, 2, 2, "F");
        doc.setTextColor(...cor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${sinal}${v.pct}%  ${v.label}`, x + 4, y + 1);
      });

      y += 12;

      // ════════════════════════════════════════
      // GRÁFICO DE LINHA — Histórico 6 meses
      // ════════════════════════════════════════
      this.secaoTitulo(doc, "Receita vs Despesas — Últimos 6 Meses", y);
      y += 8;

      await this.graficoLinha(doc, dados.historico, 14, y, W - 28, 55);
      y += 62;

      // ════════════════════════════════════════
      // DESPESAS POR CATEGORIA
      // ════════════════════════════════════════
      this.secaoTitulo(doc, "Despesas por Categoria", y);
      y += 8;

      if (dados.categorias && dados.categorias.length > 0) {
        const totalDesp = dados.categorias.reduce(
          (s, c) => s + parseFloat(c.total),
          0,
        );
        const cores = [
          this.cores.marromMd,
          this.cores.dourado,
          this.cores.roxo,
          this.cores.verde,
          this.cores.vermelho,
          this.cores.azul,
        ];

        // Barras horizontais + tabela lado a lado
        const barW = 110,
          tabelaX = 130;

        dados.categorias.slice(0, 6).forEach((cat, i) => {
          const pct = totalDesp > 0 ? parseFloat(cat.total) / totalDesp : 0;
          const fillW = barW * pct;
          const cor = cores[i % cores.length];
          const rowY = y + i * 10;

          // Label
          doc.setTextColor(...this.cores.suave);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(cat.categoria, 14, rowY + 4);

          // Track
          doc.setFillColor(240, 235, 225);
          doc.roundedRect(14, rowY + 5, barW, 4, 1, 1, "F");

          // Fill
          if (fillW > 0) {
            doc.setFillColor(...cor);
            doc.roundedRect(14, rowY + 5, fillW, 4, 1, 1, "F");
          }

          // Valor e %
          doc.setTextColor(...this.cores.texto);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text(this.fmt(cat.total), tabelaX + 30, rowY + 4, {
            align: "right",
          });
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...this.cores.suave);
          doc.text(`${Math.round(pct * 100)}%`, tabelaX + 46, rowY + 4);
        });

        y += dados.categorias.slice(0, 6).length * 10 + 8;
      } else {
        doc.setTextColor(...this.cores.suave);
        doc.setFontSize(9);
        doc.text("Nenhuma despesa registrada neste mês.", 14, y + 5);
        y += 12;
      }

      // ════════════════════════════════════════
      // GRÁFICO DE ROSCA — Distribuição
      // ════════════════════════════════════════
      if (dados.categorias && dados.categorias.length > 0) {
        this.secaoTitulo(doc, "Distribuição de Despesas", y);
        y += 8;
        await this.graficoPizza(doc, dados.categorias, 14, y, 80);
        y += 58;
      }

      // ════════════════════════════════════════
      // TOP ANIMAIS
      // ════════════════════════════════════════
      this.secaoTitulo(doc, "Maiores Custos por Animal", y);
      y += 8;

      if (dados.topAnimais && dados.topAnimais.length > 0) {
        // Cabeçalho tabela
        doc.setFillColor(...this.cores.marrom);
        doc.rect(14, y, W - 28, 7, "F");
        doc.setTextColor(...this.cores.dourado);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Animal", 18, y + 5);
        doc.text("Proprietário", 80, y + 5);
        doc.text("Total do Mês", W - 18, y + 5, { align: "right" });
        y += 7;

        dados.topAnimais.forEach((a, i) => {
          const bgCol = i % 2 === 0 ? [251, 247, 238] : [245, 239, 224];
          doc.setFillColor(...bgCol);
          doc.rect(14, y, W - 28, 8, "F");

          // Avatar colorido
          doc.setFillColor(...this.cores.marromMd);
          doc.circle(20, y + 4, 3, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(a.nome.charAt(0).toUpperCase(), 20, y + 5.5, {
            align: "center",
          });

          doc.setTextColor(...this.cores.texto);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.text(a.nome, 26, y + 5.5);

          doc.setTextColor(...this.cores.suave);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(a.proprietario || "—", 80, y + 5.5);

          doc.setTextColor(...this.cores.vermelho);
          doc.setFont("helvetica", "bold");
          doc.text(this.fmt(a.total), W - 18, y + 5.5, { align: "right" });

          y += 8;
        });
        y += 4;
      } else {
        doc.setTextColor(...this.cores.suave);
        doc.setFontSize(9);
        doc.text("Nenhum custo registrado por animal neste mês.", 14, y + 5);
        y += 12;
      }

      // ════════════════════════════════════════
      // RODAPÉ
      // ════════════════════════════════════════
      // Linha separadora
      doc.setDrawColor(...this.cores.begeEsc);
      doc.setLineWidth(0.3);
      doc.line(14, H - 18, W - 14, H - 18);

      // Lucro líquido em destaque
      doc.setFillColor(...this.cores.bege);
      doc.roundedRect(14, H - 16, W - 28, 10, 2, 2, "F");
      doc.setTextColor(...this.cores.suave);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("HF Controll  ·  Relatório Mensal Automático", 18, H - 10);
      doc.setTextColor(...this.cores.verde);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Lucro Líquido: ${this.fmt(dados.kpis.lucro.total)}`,
        W - 18,
        H - 10,
        { align: "right" },
      );

      // ── Salva o PDF ──
      doc.save(`Relatorio_${dados.nomeMes}_${dados.ano}.pdf`);
      RanchoApp.mostrarNotificacao("Relatório gerado!");
    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      RanchoApp.mostrarNotificacao("Erro ao gerar relatório.", "erro");
    }
  },

  // ── Título de seção ──
  secaoTitulo(doc, texto, y) {
    doc.setFillColor(240, 235, 225);
    doc.rect(14, y - 1, 4, 6, "F");
    doc.setFillColor(...this.cores.marromMd);
    doc.rect(14, y - 1, 2, 6, "F");

    doc.setTextColor(...this.cores.marromMd);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(texto.toUpperCase(), 22, y + 4);

    doc.setDrawColor(...this.cores.begeEsc);
    doc.setLineWidth(0.2);
    doc.line(14, y + 6, 196, y + 6);
  },

  // ── Gráfico de Linha via Canvas oculto ──
  async graficoLinha(doc, historico, x, y, largura, altura) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = largura * 4;
      canvas.height = altura * 4;
      canvas.style.display = "none";
      document.body.appendChild(canvas);

      new Chart(canvas, {
        type: "line",
        data: {
          labels: historico.map((h) => h.label),
          datasets: [
            {
              label: "Receita",
              data: historico.map((h) => h.receita),
              borderColor: "#3D7A5E",
              backgroundColor: "rgba(61,122,94,0.08)",
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#3D7A5E",
              pointRadius: 5,
            },
            {
              label: "Despesas",
              data: historico.map((h) => h.despesas),
              borderColor: "#A83232",
              backgroundColor: "rgba(168,50,50,0.05)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              borderDash: [6, 3],
              pointBackgroundColor: "#A83232",
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: { boxWidth: 12, font: { size: 14 }, color: "#5C3A1E" },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 13 }, color: "#8A6840" },
            },
            y: {
              grid: { color: "rgba(0,0,0,0.04)" },
              ticks: {
                font: { size: 12 },
                color: "#8A6840",
                callback: (v) => "R$" + Number(v).toLocaleString("pt-BR"),
              },
            },
          },
        },
      });

      setTimeout(() => {
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x, y, largura, altura);
        canvas.remove();
        resolve();
      }, 500);
    });
  },

  // ── Gráfico de Rosca via Canvas oculto ──
  async graficoPizza(doc, categorias, x, y, tamanho) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      canvas.style.display = "none";
      document.body.appendChild(canvas);

      const cores = [
        "#3D1E0A",
        "#8B5230",
        "#C49A4A",
        "#3D7A5E",
        "#7A52A0",
        "#A83232",
      ];

      new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: categorias.map((c) => c.categoria),
          datasets: [
            {
              data: categorias.map((c) => parseFloat(c.total)),
              backgroundColor: cores,
              borderWidth: 2,
              borderColor: "#FBF7EE",
            },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: {
              display: true,
              position: "right",
              labels: {
                boxWidth: 14,
                font: { size: 14 },
                color: "#5C3A1E",
                padding: 12,
              },
            },
          },
        },
      });

      setTimeout(() => {
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x, y, tamanho * 2.2, tamanho);
        canvas.remove();
        resolve();
      }, 500);
    });
  },
};
