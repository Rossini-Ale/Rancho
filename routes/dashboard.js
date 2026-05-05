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

    // Pagamentos confirmados nos últimos 7 dias
    const [pagos] = await pool.query(
      `SELECT m.valor, c.nome AS cavalo, p.nome AS proprietario, m.updated_at
       FROM Mensalidades m
       JOIN Cavalos c ON m.cavalo_id = c.id
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE m.usuario_id = ? AND m.pago = 1
         AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY m.updated_at DESC LIMIT 3`,
      [uid],
    );
    pagos.forEach((m) => {
      alertas.push({
        tipo: "pago",
        titulo: `Pagamento confirmado — ${m.cavalo}`,
        sub: m.proprietario || "Sem proprietário",
        valor: parseFloat(m.valor),
        tempo: "Recente",
      });
    });

    // Animais sem mensalidade no mês atual
    const [semMensalidade] = await pool.query(
      `SELECT c.nome FROM Cavalos c
       WHERE c.usuario_id = ?
         AND c.id NOT IN (
           SELECT cavalo_id FROM Mensalidades
           WHERE usuario_id = ? AND mes = ? AND ano = ?
         )
       LIMIT 3`,
      [uid, uid, mes, ano],
    );
    semMensalidade.forEach((c) => {
      alertas.push({
        tipo: "atencao",
        titulo: `Sem mensalidade — ${c.nome}`,
        sub: "Nenhuma mensalidade lançada neste mês",
        valor: null,
        tempo: "Agora",
      });
    });

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

module.exports = router;
