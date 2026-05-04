const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/authMiddleware");

router.use(auth);

// ══════════════════════════════════════════════════════════════
// CAVALOS
// ══════════════════════════════════════════════════════════════

// ── GET /api/gestao/cavalos ──────────────────────────────────
// Retorna cavalos JÁ com total_gasto e pendencia do mês atual
// em UMA única query — elimina N chamadas no frontend
router.get("/cavalos", async (req, res) => {
  const uid = req.user.id;
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  try {
    const [rows] = await pool.query(
      `SELECT
         c.*,
         p.nome AS nome_proprietario,
         COALESCE(
           (SELECT SUM(cu.valor)
            FROM Custos cu
            WHERE cu.cavalo_id = c.id
              AND MONTH(cu.data_despesa) = ?
              AND YEAR(cu.data_despesa)  = ?
              AND cu.usuario_id = ?),
           0
         ) +
         COALESCE(
           (SELECT m.valor
            FROM Mensalidades m
            WHERE m.cavalo_id = c.id
              AND m.mes = ? AND m.ano = ?
              AND m.usuario_id = ?
            LIMIT 1),
           0
         ) AS total_gasto_mes,
         CASE WHEN EXISTS (
           SELECT 1 FROM Custos cu2
           WHERE cu2.cavalo_id = c.id
             AND cu2.pago = 0
             AND MONTH(cu2.data_despesa) = ?
             AND YEAR(cu2.data_despesa)  = ?
             AND cu2.usuario_id = ?
         ) OR EXISTS (
           SELECT 1 FROM Mensalidades m2
           WHERE m2.cavalo_id = c.id
             AND m2.pago = 0
             AND m2.mes = ? AND m2.ano = ?
             AND m2.usuario_id = ?
         ) THEN 1 ELSE 0 END AS tem_pendente
       FROM Cavalos c
       LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
       WHERE c.usuario_id = ?
       ORDER BY c.nome ASC`,
      [
        mes,
        ano,
        uid, // total custos
        mes,
        ano,
        uid, // total mensalidade
        mes,
        ano,
        uid, // tem_pendente custos
        mes,
        ano,
        uid, // tem_pendente mensalidades
        uid, // WHERE
      ],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET /cavalos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/cavalos", async (req, res) => {
  try {
    const { nome, lugar, proprietario_id, observacoes } = req.body;
    const propId =
      !proprietario_id || proprietario_id === "null" ? null : proprietario_id;
    await pool.query(
      "INSERT INTO Cavalos (nome, lugar, proprietario_id, observacoes, usuario_id) VALUES (?,?,?,?,?)",
      [nome, lugar, propId, observacoes, req.user.id],
    );
    res.status(201).json({ message: "Cavalo criado!" });
  } catch (err) {
    console.error("Erro POST /cavalos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/cavalos/:id", async (req, res) => {
  try {
    const { nome, lugar, proprietario_id, observacoes } = req.body;
    const propId =
      !proprietario_id || proprietario_id === "null" ? null : proprietario_id;
    const [result] = await pool.query(
      "UPDATE Cavalos SET nome=?,lugar=?,proprietario_id=?,observacoes=? WHERE id=? AND usuario_id=?",
      [nome, lugar, propId, observacoes, req.params.id, req.user.id],
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });
    res.json({ message: "Atualizado!" });
  } catch (err) {
    console.error("Erro PUT /cavalos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cavalos/:id", async (req, res) => {
  try {
    // Verifica se pertence ao usuário ANTES de deletar
    const [[cavalo]] = await pool.query(
      "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
      [req.params.id, req.user.id],
    );
    if (!cavalo)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });

    await pool.query("DELETE FROM Cavalos WHERE id=?", [req.params.id]);
    res.json({ message: "Deletado" });
  } catch (err) {
    console.error("Erro DELETE /cavalos:", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PROPRIETÁRIOS
// ══════════════════════════════════════════════════════════════

// ── GET /api/gestao/proprietarios ───────────────────────────
// Retorna proprietários JÁ com total_divida e contagem de animais
// em UMA única query — elimina dezenas de chamadas no frontend
router.get("/proprietarios", async (req, res) => {
  const uid = req.user.id;
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  try {
    const [rows] = await pool.query(
      `SELECT
         p.*,
         COUNT(DISTINCT c.id) AS total_animais,
         COALESCE(
           (SELECT SUM(cu.valor)
            FROM Custos cu
            INNER JOIN Cavalos cv ON cu.cavalo_id = cv.id
            WHERE cv.proprietario_id = p.id
              AND cu.pago = 0
              AND MONTH(cu.data_despesa) = ?
              AND YEAR(cu.data_despesa)  = ?
              AND cu.usuario_id = ?),
           0
         ) +
         COALESCE(
           (SELECT SUM(m.valor)
            FROM Mensalidades m
            INNER JOIN Cavalos cv2 ON m.cavalo_id = cv2.id
            WHERE cv2.proprietario_id = p.id
              AND m.pago = 0
              AND m.mes = ? AND m.ano = ?
              AND m.usuario_id = ?),
           0
         ) +
         COALESCE(
           (SELECT SUM(cd.valor)
            FROM Custos cd
            WHERE cd.proprietario_id = p.id
              AND cd.cavalo_id IS NULL
              AND cd.pago = 0
              AND MONTH(cd.data_despesa) = ?
              AND YEAR(cd.data_despesa)  = ?
              AND cd.usuario_id = ?),
           0
         ) AS total_divida
       FROM Proprietarios p
       LEFT JOIN Cavalos c ON c.proprietario_id = p.id AND c.usuario_id = p.usuario_id
       WHERE p.usuario_id = ?
       GROUP BY p.id
       ORDER BY p.nome ASC`,
      [
        mes,
        ano,
        uid, // divida custos de cavalos
        mes,
        ano,
        uid, // divida mensalidades
        mes,
        ano,
        uid, // divida custos diretos
        uid, // WHERE
      ],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET /proprietarios:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/proprietarios", async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO Proprietarios (nome, telefone, usuario_id) VALUES (?,?,?)",
      [req.body.nome, req.body.telefone, req.user.id],
    );
    res.status(201).json({ message: "Salvo" });
  } catch (err) {
    console.error("Erro POST /proprietarios:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/proprietarios/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE Proprietarios SET nome=?,telefone=? WHERE id=? AND usuario_id=?",
      [req.body.nome, req.body.telefone, req.params.id, req.user.id],
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro PUT /proprietarios:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/proprietarios/:id", async (req, res) => {
  try {
    const [[prop]] = await pool.query(
      "SELECT id FROM Proprietarios WHERE id=? AND usuario_id=?",
      [req.params.id, req.user.id],
    );
    if (!prop)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });

    await pool.query("DELETE FROM Proprietarios WHERE id=?", [req.params.id]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro DELETE /proprietarios:", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// CUSTOS
// ══════════════════════════════════════════════════════════════

router.get("/custos/resumo/:cavaloId", async (req, res) => {
  const { mes, ano } = req.query;
  const uid = req.user.id;
  try {
    // Verifica permissão
    const [[cavalo]] = await pool.query(
      "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
      [req.params.cavaloId, uid],
    );
    if (!cavalo) return res.status(403).json({ msg: "Sem permissão" });

    const [custos] = await pool.query(
      "SELECT * FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=? ORDER BY data_despesa DESC",
      [req.params.cavaloId, mes, ano, uid],
    );

    const [mensalidades] = await pool.query(
      "SELECT * FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
      [req.params.cavaloId, mes, ano, uid],
    );

    const [[{ total }]] = await pool.query(
      "SELECT COALESCE(SUM(valor),0) AS total FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
      [req.params.cavaloId, mes, ano, uid],
    );

    let valorMensalidade = 0;
    if (mensalidades.length > 0) {
      const m = mensalidades[0];
      valorMensalidade = parseFloat(m.valor);
      custos.push({
        id: m.id,
        descricao: m.itens ? `Mensalidade (${m.itens})` : "Mensalidade",
        categoria: "Mensalidade",
        valor: m.valor,
        data_despesa: m.data_pagamento,
        is_mensalidade: true,
        pago: m.pago,
      });
    }

    res.json({ custos, total_gasto: parseFloat(total) + valorMensalidade });
  } catch (err) {
    console.error("Erro GET custos/resumo:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/custos/rancho", async (req, res) => {
  const { mes, ano } = req.query;
  const uid = req.user.id;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM Custos
       WHERE usuario_id=? AND cavalo_id IS NULL AND proprietario_id IS NULL
         AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?
       ORDER BY data_despesa DESC`,
      [uid, mes, ano],
    );
    const [[{ total }]] = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS total FROM Custos
       WHERE usuario_id=? AND cavalo_id IS NULL AND proprietario_id IS NULL
         AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?`,
      [uid, mes, ano],
    );
    res.json({ custos: rows, total_gasto: total });
  } catch (err) {
    console.error("Erro GET /custos/rancho:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/custos/diretos/:propId", async (req, res) => {
  const { mes, ano } = req.query;
  const uid = req.user.id;
  try {
    // Verifica permissão no proprietário
    const [[prop]] = await pool.query(
      "SELECT id FROM Proprietarios WHERE id=? AND usuario_id=?",
      [req.params.propId, uid],
    );
    if (!prop) return res.status(403).json({ msg: "Sem permissão" });

    const [rows] = await pool.query(
      "SELECT * FROM Custos WHERE proprietario_id=? AND cavalo_id IS NULL AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
      [req.params.propId, mes, ano, uid],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET custos/diretos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/custos", async (req, res) => {
  const {
    cavalo_id,
    proprietario_id,
    descricao,
    categoria,
    valor,
    data_despesa,
  } = req.body;
  const uid = req.user.id;
  try {
    // Se tem cavalo_id, verifica se pertence ao usuário
    if (cavalo_id) {
      const [[cav]] = await pool.query(
        "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
        [cavalo_id, uid],
      );
      if (!cav)
        return res
          .status(403)
          .json({ message: "Sem permissão para este animal." });
    }
    await pool.query(
      "INSERT INTO Custos (cavalo_id,proprietario_id,descricao,categoria,valor,data_despesa,usuario_id) VALUES (?,?,?,?,?,?,?)",
      [
        cavalo_id || null,
        proprietario_id || null,
        descricao,
        categoria,
        valor,
        data_despesa,
        uid,
      ],
    );
    res.status(201).json({ message: "Ok" });
  } catch (err) {
    console.error("Erro POST /custos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/custos/baixar-mes", async (req, res) => {
  const { proprietario_id, mes, ano } = req.body;
  const uid = req.user.id;
  try {
    // Verifica permissão
    const [[prop]] = await pool.query(
      "SELECT id FROM Proprietarios WHERE id=? AND usuario_id=?",
      [proprietario_id, uid],
    );
    if (!prop) return res.status(403).json({ message: "Sem permissão." });

    await pool.query(
      "UPDATE Custos SET pago=1 WHERE usuario_id=? AND proprietario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?",
      [uid, proprietario_id, mes, ano],
    );
    await pool.query(
      `UPDATE Mensalidades m
       INNER JOIN Cavalos c ON m.cavalo_id = c.id
       SET m.pago=1
       WHERE c.proprietario_id=? AND m.mes=? AND m.ano=? AND m.usuario_id=?`,
      [proprietario_id, mes, ano, uid],
    );
    res.json({ message: "Baixado" });
  } catch (err) {
    console.error("Erro baixar-mes:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/custos/:id", async (req, res) => {
  const { descricao, valor, categoria } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE Custos SET descricao=?,valor=?,categoria=? WHERE id=? AND usuario_id=?",
      [descricao, valor, categoria, req.params.id, req.user.id],
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro PUT /custos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/custos/:id", async (req, res) => {
  try {
    const [[custo]] = await pool.query(
      "SELECT id FROM Custos WHERE id=? AND usuario_id=?",
      [req.params.id, req.user.id],
    );
    if (!custo)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });

    await pool.query("DELETE FROM Custos WHERE id=?", [req.params.id]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro DELETE /custos:", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// MENSALIDADES
// ══════════════════════════════════════════════════════════════

router.post("/mensalidades", async (req, res) => {
  const { cavalo_id, mes, ano, valor, itens } = req.body;
  const uid = req.user.id;
  try {
    // Verifica se o cavalo pertence ao usuário
    const [[cav]] = await pool.query(
      "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
      [cavalo_id, uid],
    );
    if (!cav)
      return res
        .status(403)
        .json({ message: "Sem permissão para este animal." });

    const [[exists]] = await pool.query(
      "SELECT id FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
      [cavalo_id, mes, ano, uid],
    );
    if (exists)
      return res
        .status(409)
        .json({ message: "Mensalidade já lançada para este mês." });

    await pool.query(
      "INSERT INTO Mensalidades (cavalo_id,mes,ano,valor,itens,data_pagamento,usuario_id,pago) VALUES (?,?,?,?,?,NOW(),?,0)",
      [cavalo_id, mes, ano, valor, itens || "", uid],
    );
    res.status(201).json({ message: "Lançado como Pendente" });
  } catch (err) {
    console.error("Erro POST /mensalidades:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/mensalidades/:cavaloId", async (req, res) => {
  const uid = req.user.id;
  try {
    const [[cav]] = await pool.query(
      "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
      [req.params.cavaloId, uid],
    );
    if (!cav) return res.status(403).json({ msg: "Sem permissão" });

    const [rows] = await pool.query(
      "SELECT * FROM Mensalidades WHERE cavalo_id=? AND usuario_id=? ORDER BY ano DESC, mes DESC",
      [req.params.cavaloId, uid],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET /mensalidades:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/mensalidades/:id", async (req, res) => {
  try {
    const [[mens]] = await pool.query(
      "SELECT id FROM Mensalidades WHERE id=? AND usuario_id=?",
      [req.params.id, req.user.id],
    );
    if (!mens)
      return res
        .status(404)
        .json({ message: "Não encontrado ou sem permissão." });

    await pool.query("DELETE FROM Mensalidades WHERE id=?", [req.params.id]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro DELETE /mensalidades:", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ══════════════════════════════════════════════════════════════

router.get("/config", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Config WHERE usuario_id=?", [
      req.user.id,
    ]);
    res.json(rows[0] || { chave_pix: "" });
  } catch (err) {
    res.json({ chave_pix: "" });
  }
});

router.put("/config", async (req, res) => {
  const { chave_pix } = req.body;
  const uid = req.user.id;
  try {
    const [up] = await pool.query(
      "UPDATE Config SET chave_pix=? WHERE usuario_id=?",
      [chave_pix, uid],
    );
    if (up.affectedRows === 0) {
      await pool.query(
        "INSERT INTO Config (usuario_id,chave_pix) VALUES (?,?)",
        [uid, chave_pix],
      );
    }
    res.json({ message: "Ok" });
  } catch (err) {
    console.error("Erro PUT /config:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
