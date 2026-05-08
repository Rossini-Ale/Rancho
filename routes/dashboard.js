const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/authMiddleware");

router.use(auth);

// ── GET /api/dashboard/kpis ──────────────────────────────────────
// Retorna KPIs do mês atual vs mês anterior
router.get("/kpis", async (req, res) => {
  const uid = req.user.id;
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;

  try {
    // Animais
    const [[{ totalAnimais }]] = await pool.query(
      "SELECT COUNT(*) AS totalAnimais FROM Cavalos WHERE usuario_id = ?",
      [uid],
    );
    const [[{ animaisAnt }]] = await pool.query(
      "SELECT COUNT(*) AS animaisAnt FROM Cavalos WHERE usuario_id = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ?",
      [uid, mesAnt, anoAnt],
    );
    const [[{ animaisMes }]] = await pool.query(
      "SELECT COUNT(*) AS animaisMes FROM Cavalos WHERE usuario_id = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ?",
      [uid, mes, ano],
    );

    // Clientes
    const [[{ totalClientes }]] = await pool.query(
      "SELECT COUNT(*) AS totalClientes FROM Proprietarios WHERE usuario_id = ?",
      [uid],
    );
    const [[{ clientesMes }]] = await pool.query(
      "SELECT COUNT(*) AS clientesMes FROM Proprietarios WHERE usuario_id = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ?",
      [uid, mes, ano],
    );

    // Receita mês atual (mensalidades pagas + custos pagos de clientes)
    const [[{ receitaMes }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS receitaMes FROM Mensalidades
       WHERE usuario_id = ? AND mes = ? AND ano = ? AND pago = 1`,
      [uid, mes, ano],
    );
    const [[{ receitaAnt }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS receitaAnt FROM Mensalidades
       WHERE usuario_id = ? AND mes = ? AND ano = ? AND pago = 1`,
      [uid, mesAnt, anoAnt],
    );

    // Despesas do rancho (sem cavalo_id e sem proprietario_id)
    const [[{ despesasMes }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS despesasMes FROM Custos
       WHERE usuario_id = ? AND cavalo_id IS NULL AND proprietario_id IS NULL
       AND MONTH(data_despesa) = ? AND YEAR(data_despesa) = ?`,
      [uid, mes, ano],
    );
    const [[{ despesasAnt }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS despesasAnt FROM Custos
       WHERE usuario_id = ? AND cavalo_id IS NULL AND proprietario_id IS NULL
       AND MONTH(data_despesa) = ? AND YEAR(data_despesa) = ?`,
      [uid, mesAnt, anoAnt],
    );

    // Pendências (mensalidades não pagas no mês atual)
    const [[{ pendencias }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS pendencias FROM Mensalidades
       WHERE usuario_id = ? AND mes = ? AND ano = ? AND pago = 0`,
      [uid, mes, ano],
    );

    const pctReceita =
      receitaAnt > 0
        ? Math.round(((receitaMes - receitaAnt) / receitaAnt) * 100)
        : null;
    const pctDespesas =
      despesasAnt > 0
        ? Math.round(((despesasMes - despesasAnt) / despesasAnt) * 100)
        : null;

    res.json({
      animais: { total: totalAnimais, novos: animaisMes },
      clientes: { total: totalClientes, novos: clientesMes },
      receita: { total: parseFloat(receitaMes), pct: pctReceita },
      despesas: { total: parseFloat(despesasMes), pct: pctDespesas },
      pendencias: parseFloat(pendencias),
      mes,
      ano,
    });
  } catch (err) {
    console.error("Erro GET /kpis:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/alertas ───────────────────────────────────
// Lembretes: mensalidades vencidas, pagamentos recentes, animais sem mensalidade
router.get("/alertas", async (req, res) => {
  const uid = req.user.id;
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  try {
    const alertas = [];

    // Mensalidades pendentes do mês atual
    const [pendentes] = await pool.query(
      `SELECT m.id, m.valor, m.mes, m.ano, c.nome AS cavalo, p.nome AS proprietario
       FROM Mensalidades m
       JOIN Cavalos c ON m.cavalo_id = c.id
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE m.usuario_id = ? AND m.mes = ? AND m.ano = ? AND m.pago = 0
       ORDER BY m.id DESC LIMIT 5`,
      [uid, mes, ano],
    );
    pendentes.forEach((m) => {
      alertas.push({
        tipo: "vencido",
        titulo: `Mensalidade pendente — ${m.cavalo}`,
        sub: m.proprietario ? `Cliente: ${m.proprietario}` : "Sem proprietário",
        valor: parseFloat(m.valor),
        tempo: "Este mês",
      });
    });

    // Alertas da ficha veterinária — próximas datas vencendo
    try {
      const [fichaVet] = await pool.query(
        `SELECT fv.tipo, fv.proxima_data, c.nome AS cavalo,
           DATEDIFF(fv.proxima_data, CURDATE()) AS dias_restantes
         FROM FichaVeterinaria fv
         JOIN Cavalos c ON fv.cavalo_id = c.id
         WHERE fv.usuario_id = ?
           AND fv.proxima_data IS NOT NULL
           AND fv.proxima_data >= CURDATE() - INTERVAL 1 DAY
           AND fv.proxima_data <= CURDATE() + INTERVAL 14 DAY
         ORDER BY fv.proxima_data ASC
         LIMIT 4`,
        [uid],
      );
      fichaVet.forEach((f) => {
        const dias = parseInt(f.dias_restantes);
        const tipo = dias < 0 ? "vencido" : dias <= 3 ? "vencido" : "atencao";
        const tempo =
          dias < 0
            ? "Vencida"
            : dias === 0
              ? "Hoje"
              : dias === 1
                ? "Amanhã"
                : `${dias} dias`;
        alertas.push({
          tipo,
          titulo: `${f.tipo} — ${f.cavalo}`,
          sub: dias < 0 ? "Data vencida, agendar!" : "Agendar em breve",
          valor: null,
          tempo,
        });
      });
    } catch (e) {
      // FichaVeterinaria pode não existir em bancos antigos
    }

    res.json(alertas.slice(0, 8));
  } catch (err) {
    console.error("Erro GET /alertas:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/despesas-categorias ───────────────────────
// Despesas agrupadas por categoria no mês atual
router.get("/despesas-categorias", async (req, res) => {
  const uid = req.user.id;
  const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
  const ano = parseInt(req.query.ano) || new Date().getFullYear();

  try {
    const [rows] = await pool.query(
      `SELECT categoria, COALESCE(SUM(valor),0) AS total
       FROM Custos
       WHERE usuario_id = ?
         AND MONTH(data_despesa) = ? AND YEAR(data_despesa) = ?
       GROUP BY categoria
       ORDER BY total DESC`,
      [uid, mes, ano],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET /despesas-categorias:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/historico ────────────────────────────────
// Receita e despesa dos últimos 6 meses para gráfico de linha
router.get("/historico", async (req, res) => {
  const uid = req.user.id;
  const meses = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
  }

  try {
    const resultado = await Promise.all(
      meses.map(async ({ mes, ano }) => {
        const [[{ receita }]] = await pool.query(
          "SELECT COALESCE(SUM(valor),0) AS receita FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
          [uid, mes, ano],
        );
        const [[{ despesas }]] = await pool.query(
          "SELECT COALESCE(SUM(valor),0) AS despesas FROM Custos WHERE usuario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND cavalo_id IS NULL AND proprietario_id IS NULL",
          [uid, mes, ano],
        );
        const nomes = [
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
        return {
          label: nomes[mes - 1],
          receita: parseFloat(receita),
          despesas: parseFloat(despesas),
        };
      }),
    );
    res.json(resultado);
  } catch (err) {
    console.error("Erro GET /historico:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/relatorio?mes=5&ano=2026 ─────────────
// Retorna todos os dados necessários para o relatório mensal
router.get("/relatorio", async (req, res) => {
  const uid = req.user.id;
  const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
  const ano = parseInt(req.query.ano) || new Date().getFullYear();

  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;

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
    const [[{ receitaMes }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS receitaMes FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
      [uid, mes, ano],
    );
    const [[{ receitaAnt }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS receitaAnt FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
      [uid, mesAnt, anoAnt],
    );
    const [[{ despesasMes }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS despesasMes FROM Custos
       WHERE usuario_id=? AND cavalo_id IS NULL AND proprietario_id IS NULL
         AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?`,
      [uid, mes, ano],
    );
    const [[{ despesasAnt }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS despesasAnt FROM Custos
       WHERE usuario_id=? AND cavalo_id IS NULL AND proprietario_id IS NULL
         AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?`,
      [uid, mesAnt, anoAnt],
    );
    const [[{ pendencias }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS pendencias FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=0",
      [uid, mes, ano],
    );
    const [[{ clientesPendentes }]] = await pool.query(
      `SELECT COUNT(DISTINCT cv.proprietario_id) AS clientesPendentes
       FROM Mensalidades m JOIN Cavalos cv ON m.cavalo_id = cv.id
       WHERE m.usuario_id=? AND m.mes=? AND m.ano=? AND m.pago=0`,
      [uid, mes, ano],
    );
    const [categorias] = await pool.query(
      `SELECT categoria, COALESCE(SUM(valor),0) AS total
       FROM Custos WHERE usuario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?
       GROUP BY categoria ORDER BY total DESC`,
      [uid, mes, ano],
    );
    const [topAnimais] = await pool.query(
      `SELECT c.nome, p.nome AS proprietario,
         COALESCE(SUM(cu.valor),0) +
         COALESCE((SELECT m.valor FROM Mensalidades m WHERE m.cavalo_id=c.id AND m.mes=? AND m.ano=? AND m.usuario_id=? LIMIT 1),0) AS total
       FROM Cavalos c
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       LEFT JOIN Custos cu ON cu.cavalo_id = c.id
         AND MONTH(cu.data_despesa)=? AND YEAR(cu.data_despesa)=? AND cu.usuario_id=?
       WHERE c.usuario_id=?
       GROUP BY c.id, c.nome, p.nome
       HAVING total > 0
       ORDER BY total DESC LIMIT 5`,
      [mes, ano, uid, mes, ano, uid, uid],
    );
    const historico = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      const m = d.getMonth() + 1;
      const a = d.getFullYear();
      const [[{ rec }]] = await pool.query(
        "SELECT COALESCE(SUM(valor),0) AS rec FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
        [uid, m, a],
      );
      const [[{ desp }]] = await pool.query(
        "SELECT COALESCE(SUM(valor),0) AS desp FROM Custos WHERE usuario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND cavalo_id IS NULL AND proprietario_id IS NULL",
        [uid, m, a],
      );
      historico.push({
        label: nomesMeses[m - 1].substring(0, 3),
        receita: parseFloat(rec),
        despesas: parseFloat(desp),
      });
    }

    const recF = parseFloat(receitaMes);
    const despF = parseFloat(despesasMes);
    const pctReceita =
      parseFloat(receitaAnt) > 0
        ? Math.round(
            ((recF - parseFloat(receitaAnt)) / parseFloat(receitaAnt)) * 100,
          )
        : null;
    const pctDespesas =
      parseFloat(despesasAnt) > 0
        ? Math.round(
            ((despF - parseFloat(despesasAnt)) / parseFloat(despesasAnt)) * 100,
          )
        : null;

    res.json({
      mes,
      ano,
      nomeMes: nomesMeses[mes - 1],
      kpis: {
        receita: { total: recF, pct: pctReceita },
        despesas: { total: despF, pct: pctDespesas },
        lucro: { total: recF - despF },
        pendencias: {
          total: parseFloat(pendencias),
          clientes: clientesPendentes,
        },
      },
      categorias,
      topAnimais,
      historico,
    });
  } catch (err) {
    console.error("Erro GET /relatorio:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// Adicione estas rotas no routes/dashboard.js
// antes do module.exports = router
// ═══════════════════════════════════════════════════════════

// ── GET /api/dashboard/cobrancas ─────────────────────────────
// Retorna todas as mensalidades pendentes com dias de atraso
router.get("/cobrancas", async (req, res) => {
  const uid = req.user.id;
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  try {
    // Busca mensalidades não pagas com dados do animal e proprietário
    const [pendentes] = await pool.query(
      `SELECT
         m.id, m.mes, m.ano, m.valor, m.itens,
         c.id AS cavalo_id, c.nome AS cavalo,
         p.id AS proprietario_id, p.nome AS proprietario, p.telefone,
         DATEDIFF(NOW(), STR_TO_DATE(CONCAT(m.ano,'-',LPAD(m.mes,2,'0'),'-01'), '%Y-%m-%d')) AS dias_atraso
       FROM Mensalidades m
       JOIN Cavalos c ON m.cavalo_id = c.id
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE m.usuario_id = ? AND m.pago = 0
       ORDER BY dias_atraso DESC`,
      [uid],
    );

    // Custos diretos não pagos por proprietário
    const [custosDiretos] = await pool.query(
      `SELECT
         cu.id, cu.descricao, cu.valor, cu.data_despesa,
         p.id AS proprietario_id, p.nome AS proprietario, p.telefone,
         DATEDIFF(NOW(), cu.data_despesa) AS dias_atraso
       FROM Custos cu
       JOIN Proprietarios p ON cu.proprietario_id = p.id
       WHERE cu.usuario_id = ? AND cu.pago = 0
         AND cu.proprietario_id IS NOT NULL AND cu.cavalo_id IS NULL
       ORDER BY dias_atraso DESC`,
      [uid],
    );

    // Total em atraso
    const totalPendente =
      pendentes.reduce((s, m) => s + parseFloat(m.valor), 0) +
      custosDiretos.reduce((s, c) => s + parseFloat(c.valor), 0);

    // Receita do mês atual
    const [[{ receitaMes }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS receitaMes FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
      [uid, mesAtual, anoAtual],
    );
    const mesAnt = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAnt = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    const [[{ receitaAnt }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS receitaAnt FROM Mensalidades WHERE usuario_id=? AND mes=? AND ano=? AND pago=1",
      [uid, mesAnt, anoAnt],
    );
    const pctReceita =
      parseFloat(receitaAnt) > 0
        ? Math.round(
            ((parseFloat(receitaMes) - parseFloat(receitaAnt)) /
              parseFloat(receitaAnt)) *
              100,
          )
        : null;

    res.json({
      pendentes: pendentes.map((m) => ({
        ...m,
        valor: parseFloat(m.valor),
        dias_atraso: parseInt(m.dias_atraso) || 0,
      })),
      custosDiretos: custosDiretos.map((c) => ({
        ...c,
        valor: parseFloat(c.valor),
        dias_atraso: parseInt(c.dias_atraso) || 0,
      })),
      totalPendente,
      receitaMes: parseFloat(receitaMes),
      pctReceita,
    });
  } catch (err) {
    console.error("Erro GET /cobrancas:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/historico-cliente/:propId ─────────────
// Histórico completo de pagamentos de um cliente (12 meses)
router.get("/historico-cliente/:propId", async (req, res) => {
  const uid = req.user.id;
  const propId = req.params.propId;

  try {
    // Verifica permissão
    const [[prop]] = await pool.query(
      "SELECT id, nome, telefone FROM Proprietarios WHERE id=? AND usuario_id=?",
      [propId, uid],
    );
    if (!prop) return res.status(403).json({ message: "Sem permissão." });

    // Cavalos do proprietário
    const [cavalos] = await pool.query(
      "SELECT id, nome FROM Cavalos WHERE proprietario_id=? AND usuario_id=?",
      [propId, uid],
    );

    // Histórico de mensalidades dos últimos 12 meses
    const historico = [];
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();
      const nomes = [
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

      const mensalidadesMes = [];
      for (const cavalo of cavalos) {
        const [mens] = await pool.query(
          "SELECT * FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
          [cavalo.id, mes, ano, uid],
        );
        if (mens.length > 0) {
          mensalidadesMes.push({
            cavalo: cavalo.nome,
            valor: parseFloat(mens[0].valor),
            pago: mens[0].pago == 1,
            id: mens[0].id,
          });
        }
      }

      // Custos diretos do mês
      const [diretos] = await pool.query(
        "SELECT * FROM Custos WHERE proprietario_id=? AND cavalo_id IS NULL AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
        [propId, mes, ano, uid],
      );

      const totalMes =
        mensalidadesMes.reduce((s, m) => s + m.valor, 0) +
        diretos.reduce((s, c) => s + parseFloat(c.valor), 0);
      const totalPago =
        mensalidadesMes.filter((m) => m.pago).reduce((s, m) => s + m.valor, 0) +
        diretos
          .filter((c) => c.pago)
          .reduce((s, c) => s + parseFloat(c.valor), 0);
      const temPendente =
        mensalidadesMes.some((m) => !m.pago) || diretos.some((c) => !c.pago);

      historico.push({
        label: nomes[mes - 1],
        mes,
        ano,
        totalMes,
        totalPago,
        temPendente,
        mensalidades: mensalidadesMes,
        diretos: diretos.map((c) => ({ ...c, valor: parseFloat(c.valor) })),
      });
    }

    // Estatísticas gerais
    const mesesComDados = historico.filter((h) => h.totalMes > 0);
    const mesesEmDia = mesesComDados.filter((h) => !h.temPendente).length;
    const mesesAtrasados = mesesComDados.filter((h) => h.temPendente).length;
    const taxaPagamento =
      mesesComDados.length > 0
        ? Math.round((mesesEmDia / mesesComDados.length) * 100)
        : 100;

    res.json({
      proprietario: prop,
      cavalos,
      historico,
      stats: { mesesEmDia, mesesAtrasados, taxaPagamento },
    });
  } catch (err) {
    console.error("Erro GET /historico-cliente:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/busca?q=termo ─────────────────────────
// Busca global em animais, clientes e custos
router.get("/busca", async (req, res) => {
  const uid = req.user.id;
  const termo = `%${req.query.q || ""}%`;

  if (!req.query.q || req.query.q.trim().length < 2) {
    return res.json({ cavalos: [], proprietarios: [], custos: [] });
  }

  try {
    const [cavalos] = await pool.query(
      `SELECT c.id, c.nome, c.lugar, c.proprietario_id,
         p.nome AS nome_proprietario,
         COALESCE((SELECT SUM(cu.valor) FROM Custos cu WHERE cu.cavalo_id=c.id AND MONTH(cu.data_despesa)=MONTH(NOW()) AND YEAR(cu.data_despesa)=YEAR(NOW()) AND cu.usuario_id=c.usuario_id),0) AS total_mes
       FROM Cavalos c
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE c.usuario_id=? AND (c.nome LIKE ? OR c.lugar LIKE ? OR p.nome LIKE ?)
       LIMIT 5`,
      [uid, termo, termo, termo],
    );

    const [proprietarios] = await pool.query(
      `SELECT id, nome, telefone FROM Proprietarios
       WHERE usuario_id=? AND (nome LIKE ? OR telefone LIKE ?)
       LIMIT 5`,
      [uid, termo, termo],
    );

    const [custos] = await pool.query(
      `SELECT cu.id, cu.descricao, cu.categoria, cu.valor, cu.data_despesa, cu.pago,
         c.nome AS cavalo, p.nome AS proprietario
       FROM Custos cu
       LEFT JOIN Cavalos c ON cu.cavalo_id = c.id
       LEFT JOIN Proprietarios p ON cu.proprietario_id = p.id
       WHERE cu.usuario_id=? AND (cu.descricao LIKE ? OR cu.categoria LIKE ? OR c.nome LIKE ? OR p.nome LIKE ?)
       ORDER BY cu.data_despesa DESC
       LIMIT 5`,
      [uid, termo, termo, termo, termo],
    );

    res.json({
      cavalos: cavalos.map((c) => ({
        ...c,
        total_mes: parseFloat(c.total_mes),
      })),
      proprietarios,
      custos: custos.map((c) => ({ ...c, valor: parseFloat(c.valor) })),
    });
  } catch (err) {
    console.error("Erro GET /busca:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// Adicione esta rota no routes/dashboard.js
// antes do module.exports = router
// ═══════════════════════════════════════════════════════════

// ── GET /api/dashboard/ocupacao ──────────────────────────────
// Retorna mapa de ocupação agrupado por tipo de local
router.get("/ocupacao", async (req, res) => {
  const uid = req.user.id;
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  try {
    // Busca todos os animais com total do mês já calculado
    const [animais] = await pool.query(
      `SELECT
         c.id, c.nome, c.lugar, c.proprietario_id, c.observacoes,
         p.nome AS nome_proprietario, p.telefone,
         COALESCE(
           (SELECT SUM(cu.valor) FROM Custos cu
            WHERE cu.cavalo_id = c.id
              AND MONTH(cu.data_despesa) = ? AND YEAR(cu.data_despesa) = ?
              AND cu.usuario_id = ?), 0
         ) +
         COALESCE(
           (SELECT m.valor FROM Mensalidades m
            WHERE m.cavalo_id = c.id AND m.mes = ? AND m.ano = ?
              AND m.usuario_id = ? LIMIT 1), 0
         ) AS total_mes,
         CASE WHEN EXISTS (
           SELECT 1 FROM Mensalidades m2
           WHERE m2.cavalo_id = c.id AND m2.mes = ? AND m2.ano = ?
             AND m2.pago = 0 AND m2.usuario_id = ?
         ) OR EXISTS (
           SELECT 1 FROM Custos cu2
           WHERE cu2.cavalo_id = c.id AND cu2.pago = 0
             AND MONTH(cu2.data_despesa) = ? AND YEAR(cu2.data_despesa) = ?
             AND cu2.usuario_id = ?
         ) THEN 1 ELSE 0 END AS tem_pendente
       FROM Cavalos c
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE c.usuario_id = ?
       ORDER BY c.lugar ASC, c.nome ASC`,
      [mes, ano, uid, mes, ano, uid, mes, ano, uid, mes, ano, uid, uid],
    );

    // Agrupa por tipo de local detectado automaticamente pelo nome
    const locais = {};
    const semLocal = [];

    animais.forEach((a) => {
      const lugar = (a.lugar || "").trim();
      if (!lugar) {
        semLocal.push(a);
        return;
      }

      // Detecta o tipo pelo nome do local
      const lugarLower = lugar.toLowerCase();
      let tipo = "Outros";
      if (lugarLower.includes("baia") || lugarLower.includes("baía"))
        tipo = "Baias";
      else if (lugarLower.includes("piquete")) tipo = "Piquetes";
      else if (lugarLower.includes("tronco")) tipo = "Troncos";
      else if (lugarLower.includes("isolamento")) tipo = "Isolamento";

      if (!locais[tipo]) locais[tipo] = {};
      if (!locais[tipo][lugar]) locais[tipo][lugar] = [];
      locais[tipo][lugar].push(a);
    });

    // Monta a estrutura de resposta com locais ocupados
    const grupos = Object.entries(locais).map(([tipo, lugares]) => {
      const slots = Object.entries(lugares).map(([nome, animaisLocal]) => ({
        nome,
        ocupado: true,
        animais: animaisLocal.map((a) => ({
          id: a.id,
          nome: a.nome,
          proprietario: a.nome_proprietario || null,
          proprietario_id: a.proprietario_id,
          total_mes: parseFloat(a.total_mes || 0),
          tem_pendente: a.tem_pendente == 1,
          observacoes: a.observacoes,
        })),
      }));

      // Ordena os slots pelo número no nome (Baia 1, Baia 2...)
      slots.sort((a, b) => {
        const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
        return numA - numB || a.nome.localeCompare(b.nome);
      });

      return { tipo, slots, total: slots.length, ocupados: slots.length };
    });

    // Ordena os grupos (Baias primeiro, depois Piquetes, depois outros)
    const ordem = ["Baias", "Piquetes", "Troncos", "Isolamento", "Outros"];
    grupos.sort((a, b) => {
      const ia = ordem.indexOf(a.tipo);
      const ib = ordem.indexOf(b.tipo);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    // Totais gerais
    const totalAnimais = animais.length;
    const totalOcupados = animais.filter((a) => a.lugar).length;
    const totalSemLocal = semLocal.length;

    res.json({
      grupos,
      semLocal: semLocal.map((a) => ({
        id: a.id,
        nome: a.nome,
        proprietario: a.nome_proprietario || null,
        proprietario_id: a.proprietario_id,
        total_mes: parseFloat(a.total_mes || 0),
        tem_pendente: a.tem_pendente == 1,
        observacoes: a.observacoes,
        lugar: a.lugar,
      })),
      stats: {
        totalAnimais,
        totalOcupados,
        totalSemLocal,
        taxaOcupacao:
          totalAnimais > 0
            ? Math.round((totalOcupados / totalAnimais) * 100)
            : 0,
      },
    });
  } catch (err) {
    console.error("Erro GET /ocupacao:", err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
