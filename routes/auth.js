const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Cadastro de novos usuários (Agora inclui Username)
router.post("/cadastro", async (req, res) => {
  try {
    // Recebe username além de nome e email
    const { nome, email, username, senha } = req.body;

    if (!nome || !email || !username || !senha)
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });

    // Verifica se e-mail OU username já existem
    const [usuariosExistentes] = await pool.query(
      "SELECT id FROM Usuarios WHERE email = ? OR username = ?",
      [email, username],
    );

    if (usuariosExistentes.length > 0)
      return res
        .status(409)
        .json({ message: "E-mail ou Nome de Usuário já em uso." });

    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    // Insere no banco com a coluna username
    const [result] = await pool.query(
      "INSERT INTO Usuarios (nome, email, username, senha_hash) VALUES (?, ?, ?, ?)",
      [nome, email, username, senha_hash],
    );

    res.status(201).json({
      message: "Usuário cadastrado com sucesso!",
      usuarioId: result.insertId,
    });
  } catch (error) {
    console.error("Erro na rota /cadastro:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// Login (Agora por Username)
router.post("/login", async (req, res) => {
  try {
    // Recebe username em vez de email
    const { username, password } = req.body; // 'password' para alinhar com o front

    // Nota: aceita 'senha' ou 'password' para compatibilidade
    const senhaFinal = password || req.body.senha;

    if (!username || !senhaFinal)
      return res
        .status(400)
        .json({ message: "Usuário e senha são obrigatórios." });

    // Busca no banco pelo USERNAME
    const [usuarios] = await pool.query(
      "SELECT * FROM Usuarios WHERE username = ?",
      [username],
    );

    if (usuarios.length === 0)
      return res.status(401).json({ message: "Usuário ou senha incorretos." });

    const usuario = usuarios[0];

    // Compara a senha
    const senhaCorresponde = await bcrypt.compare(
      senhaFinal,
      usuario.senha_hash,
    );
    if (!senhaCorresponde)
      return res.status(401).json({ message: "Usuário ou senha incorretos." });

    // Gera o token
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username }, // Payload com username
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: false, // Em produção mude para true
      maxAge: 8 * 60 * 60 * 1000,
    });

    // Retorna o token para salvar no localStorage
    res.status(200).json({
      message: "Login bem-sucedido!",
      token: token,
    });
  } catch (error) {
    console.error("Erro na rota /login:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.cookie("authToken", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logout bem-sucedido." });
});

module.exports = router;
