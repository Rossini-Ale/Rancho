const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verificarToken = require("../middleware/authMiddleware");

router.use(verificarToken);

// =======================
// CAVALOS
// =======================

router.get("/cavalos", async (req, res) => {
  try {
    const sql = `
            SELECT c.*, p.nome as nome_proprietario 
            FROM Cavalos c
            LEFT JOIN Proprietarios p ON c.proprietario_id = p.id
            WHERE c.usuario_id = ?`;
    const [rows] = await pool.query(sql, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cavalos", async (req, res) => {
  try {
    const { nome, lugar, proprietario_id, observacoes } = req.body;
    const propId =
      proprietario_id === "" || proprietario_id === "null"
        ? null
        : proprietario_id;

    await pool.query(
      "INSERT INTO Cavalos (nome, lugar, proprietario_id, observacoes, usuario_id) VALUES (?, ?, ?, ?, ?)",
      [nome, lugar, propId, observacoes, req.user.id],
    );
    res.status(201).json({ message: "Cavalo criado!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/cavalos/:id", async (req, res) => {
  try {
    const { nome, lugar, proprietario_id, observacoes } = req.body;
    const propId =
      proprietario_id === "" || proprietario_id === "null"
        ? null
        : proprietario_id;

    const [result] = await pool.query(
      "UPDATE Cavalos SET nome=?, lugar=?, proprietario_id=?, observacoes=? WHERE id=? AND usuario_id=?",
      [nome, lugar, propId, observacoes, req.params.id, req.user.id],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Não encontrado." });
    res.json({ message: "Cavalo atualizado!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cavalos/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Cavalos WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: "Deletado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// PROPRIETÁRIOS
// =======================

router.get("/proprietarios", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM Proprietarios WHERE usuario_id = ?",
    [req.user.id],
  );
  res.json(rows);
});
router.post("/proprietarios", async (req, res) => {
  await pool.query(
    "INSERT INTO Proprietarios (nome, telefone, usuario_id) VALUES (?, ?, ?)",
    [req.body.nome, req.body.telefone, req.user.id],
  );
  res.status(201).json({ message: "Salvo" });
});
router.put("/proprietarios/:id", async (req, res) => {
  await pool.query(
    "UPDATE Proprietarios SET nome=?, telefone=? WHERE id=? AND usuario_id=?",
    [req.body.nome, req.body.telefone, req.params.id, req.user.id],
  );
  res.json({ message: "Ok" });
});
router.delete("/proprietarios/:id", async (req, res) => {
  await pool.query("DELETE FROM Proprietarios WHERE id=? AND usuario_id=?", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: "Ok" });
});

// =======================
// CUSTOS
// =======================

router.get("/custos/resumo/:cavaloId", async (req, res) => {
  const { mes, ano } = req.query;
  const [check] = await pool.query(
    "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
    [req.params.cavaloId, req.user.id],
  );
  if (!check.length) return res.status(403).json({ msg: "Sem permissão" });

  const [custos] = await pool.query(
    "SELECT * FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
    [req.params.cavaloId, mes, ano, req.user.id],
  );
  const [total] = await pool.query(
    "SELECT SUM(valor) as total FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
    [req.params.cavaloId, mes, ano, req.user.id],
  );
  res.json({ custos, total_gasto: total[0].total || 0 });
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
  await pool.query(
    "INSERT INTO Custos (cavalo_id, proprietario_id, descricao, categoria, valor, data_despesa, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      cavalo_id || null,
      proprietario_id || null,
      descricao,
      categoria,
      valor,
      data_despesa,
      req.user.id,
    ],
  );
  res.status(201).json({ message: "Ok" });
});

router.get("/custos/diretos/:propId", async (req, res) => {
  const { mes, ano } = req.query;
  const [rows] = await pool.query(
    "SELECT * FROM Custos WHERE proprietario_id=? AND cavalo_id IS NULL AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
    [req.params.propId, mes, ano, req.user.id],
  );
  res.json(rows);
});

// Importante: Rota Específica ANTES da Genérica (:id)
router.put("/custos/baixar-mes", async (req, res) => {
  const { proprietario_id, mes, ano } = req.body;
  await pool.query(
    "UPDATE Custos SET pago=1 WHERE usuario_id=? AND proprietario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?",
    [req.user.id, proprietario_id, mes, ano],
  );
  res.json({ message: "Baixado" });
});

router.put("/custos/:id", async (req, res) => {
  const { descricao, valor, categoria } = req.body;
  await pool.query(
    "UPDATE Custos SET descricao=?, valor=?, categoria=? WHERE id=? AND usuario_id=?",
    [descricao, valor, categoria, req.params.id, req.user.id],
  );
  res.json({ message: "Ok" });
});

router.delete("/custos/:id", async (req, res) => {
  await pool.query("DELETE FROM Custos WHERE id=? AND usuario_id=?", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: "Ok" });
});

// =======================
// MENSALIDADES (NOVO)
// =======================

router.post("/mensalidades", async (req, res) => {
  try {
    const { cavalo_id, mes, ano, valor, data_pagamento } = req.body;
    // Evita duplicidade simples
    const [exists] = await pool.query(
      "SELECT id FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
      [cavalo_id, mes, ano, req.user.id],
    );
    if (exists.length > 0)
      return res.status(409).json({ message: "Mês já pago." });

    await pool.query(
      "INSERT INTO Mensalidades (cavalo_id, mes, ano, valor, data_pagamento, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
      [cavalo_id, mes, ano, valor, data_pagamento, req.user.id],
    );
    res.status(201).json({ message: "Salvo" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/mensalidades/:cavaloId", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM Mensalidades WHERE cavalo_id=? AND usuario_id=? ORDER BY ano DESC, mes DESC",
    [req.params.cavaloId, req.user.id],
  );
  res.json(rows);
});

router.delete("/mensalidades/:id", async (req, res) => {
  await pool.query("DELETE FROM Mensalidades WHERE id=? AND usuario_id=?", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: "Ok" });
});

// =======================
// CONFIGURAÇÃO
// =======================

router.get("/config", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM Config WHERE usuario_id=?", [
    req.user.id,
  ]);
  res.json(rows[0] || { nome_rancho: "Rancho Control" });
});
router.put("/config", async (req, res) => {
  const { nome_rancho } = req.body;
  const [up] = await pool.query(
    "UPDATE Config SET nome_rancho=? WHERE usuario_id=?",
    [nome_rancho, req.user.id],
  );
  if (up.affectedRows === 0)
    await pool.query(
      "INSERT INTO Config (usuario_id, nome_rancho) VALUES (?, ?)",
      [req.user.id, nome_rancho],
    );
  res.json({ message: "Ok" });
});

module.exports = router;
