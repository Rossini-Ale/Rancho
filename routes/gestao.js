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
    console.error("Erro GET /cavalos:", err);
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
    console.error("Erro POST /cavalos:", err);
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
    console.error("Erro PUT /cavalos:", err);
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
    console.error("Erro DELETE /cavalos:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// PROPRIETÁRIOS
// =======================

router.get("/proprietarios", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Proprietarios WHERE usuario_id = ?",
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/proprietarios", async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO Proprietarios (nome, telefone, usuario_id) VALUES (?, ?, ?)",
      [req.body.nome, req.body.telefone, req.user.id],
    );
    res.status(201).json({ message: "Salvo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/proprietarios/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Proprietarios SET nome=?, telefone=? WHERE id=? AND usuario_id=?",
      [req.body.nome, req.body.telefone, req.params.id, req.user.id],
    );
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/proprietarios/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Proprietarios WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CUSTOS
// =======================

router.get("/custos/resumo/:cavaloId", async (req, res) => {
  const { mes, ano } = req.query;
  try {
    const [check] = await pool.query(
      "SELECT id FROM Cavalos WHERE id=? AND usuario_id=?",
      [req.params.cavaloId, req.user.id],
    );
    if (!check.length) return res.status(403).json({ msg: "Sem permissão" });

    // 1. Busca os Custos Variáveis
    const [custos] = await pool.query(
      "SELECT * FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
      [req.params.cavaloId, mes, ano, req.user.id],
    );

    // 2. Busca a Mensalidade do mesmo mês
    const [mensalidades] = await pool.query(
      "SELECT * FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
      [req.params.cavaloId, mes, ano, req.user.id],
    );

    // 3. Calcula total dos custos normais
    const [totalCustos] = await pool.query(
      "SELECT SUM(valor) as total FROM Custos WHERE cavalo_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
      [req.params.cavaloId, mes, ano, req.user.id],
    );

    let valorMensalidade = 0;

    // Se existir mensalidade, adiciona como item na lista de custos
    if (mensalidades.length > 0) {
      const m = mensalidades[0];
      valorMensalidade = parseFloat(m.valor);
      const descDetalhada = m.itens
        ? `Mensalidade (${m.itens})`
        : "Mensalidade";

      custos.push({
        id: m.id,
        descricao: descDetalhada,
        categoria: "Mensalidade",
        valor: m.valor,
        data_despesa: m.data_pagamento,
        is_mensalidade: true,
        pago: m.pago,
      });
    }

    const totalGeral =
      (parseFloat(totalCustos[0].total) || 0) + valorMensalidade;

    res.json({ custos, total_gasto: totalGeral });
  } catch (err) {
    console.error("Erro GET custos/resumo:", err);
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
  try {
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
  } catch (err) {
    console.error("Erro POST /custos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/custos/diretos/:propId", async (req, res) => {
  const { mes, ano } = req.query;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Custos WHERE proprietario_id=? AND cavalo_id IS NULL AND MONTH(data_despesa)=? AND YEAR(data_despesa)=? AND usuario_id=?",
      [req.params.propId, mes, ano, req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/custos/baixar-mes", async (req, res) => {
  const { proprietario_id, mes, ano } = req.body;
  try {
    await pool.query(
      "UPDATE Custos SET pago=1 WHERE usuario_id=? AND proprietario_id=? AND MONTH(data_despesa)=? AND YEAR(data_despesa)=?",
      [req.user.id, proprietario_id, mes, ano],
    );

    const sqlMensalidades = `
      UPDATE Mensalidades m
      INNER JOIN Cavalos c ON m.cavalo_id = c.id
      SET m.pago = 1
      WHERE c.proprietario_id = ? 
        AND m.mes = ? 
        AND m.ano = ? 
        AND m.usuario_id = ?
    `;
    await pool.query(sqlMensalidades, [proprietario_id, mes, ano, req.user.id]);

    res.json({ message: "Baixado" });
  } catch (err) {
    console.error("Erro baixar-mes:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/custos/:id", async (req, res) => {
  const { descricao, valor, categoria } = req.body;
  try {
    await pool.query(
      "UPDATE Custos SET descricao=?, valor=?, categoria=? WHERE id=? AND usuario_id=?",
      [descricao, valor, categoria, req.params.id, req.user.id],
    );
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/custos/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Custos WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// MENSALIDADES
// =======================

router.post("/mensalidades", async (req, res) => {
  try {
    const { cavalo_id, mes, ano, valor, itens } = req.body;
    const [exists] = await pool.query(
      "SELECT id FROM Mensalidades WHERE cavalo_id=? AND mes=? AND ano=? AND usuario_id=?",
      [cavalo_id, mes, ano, req.user.id],
    );
    if (exists.length > 0)
      return res
        .status(409)
        .json({ message: "Mensalidade já lançada para este mês." });

    await pool.query(
      "INSERT INTO Mensalidades (cavalo_id, mes, ano, valor, itens, data_pagamento, usuario_id, pago) VALUES (?, ?, ?, ?, ?, NOW(), ?, 0)",
      [cavalo_id, mes, ano, valor, itens || "", req.user.id],
    );
    res.status(201).json({ message: "Lançado como Pendente" });
  } catch (err) {
    console.error("Erro POST mensalidades:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/mensalidades/:cavaloId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Mensalidades WHERE cavalo_id=? AND usuario_id=? ORDER BY ano DESC, mes DESC",
      [req.params.cavaloId, req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/mensalidades/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Mensalidades WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// ESTOQUE (CORRIGIDO)
// =======================

router.get("/estoque", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Estoque WHERE usuario_id = ?",
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro GET /estoque:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/estoque/compra", async (req, res) => {
  const { item_nome, quantidade, unidade, valor_total } = req.body;
  const usuario_id = req.user.id;

  try {
    // 1. Atualiza ou Insere no estoque
    // Sintaxe compatível com todas as versões MySQL (evitando VALUES() deprecated)
    const sqlEstoque = `
      INSERT INTO Estoque (usuario_id, item_nome, quantidade, unidade) 
      VALUES (?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
      quantidade = quantidade + ?, 
      updated_at = NOW()
    `;

    // Note que passamos 'quantidade' duas vezes nos parâmetros
    await pool.query(sqlEstoque, [
      usuario_id,
      item_nome,
      quantidade,
      unidade,
      quantidade,
    ]);

    // 2. Registra o Custo Financeiro (Categoria Rancho/Estoque)
    await pool.query(
      "INSERT INTO Custos (cavalo_id, proprietario_id, descricao, categoria, valor, data_despesa, usuario_id) VALUES (NULL, NULL, ?, 'Estoque', ?, NOW(), ?)",
      [
        `Compra: ${quantidade} ${unidade} de ${item_nome}`,
        valor_total,
        usuario_id,
      ],
    );

    res.status(201).json({ message: "Estoque e custo registrados!" });
  } catch (err) {
    console.error("Erro POST /estoque/compra:", err); // ISSO VAI MOSTRAR O ERRO NO TERMINAL
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CONFIGURAÇÃO
// =======================

router.get("/config", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Config WHERE usuario_id=?", [
      req.user.id,
    ]);
    res.json(rows[0] || { nome_rancho: "Rancho Control" });
  } catch (err) {
    console.error(err);
    res.json({ nome_rancho: "Rancho Control" });
  }
});

router.put("/config", async (req, res) => {
  const { nome_rancho } = req.body;
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
