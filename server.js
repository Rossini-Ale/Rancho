const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Importa as rotas (auth e gestao da pasta routes/index.js)
const routes = require("./routes/index");

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rotas da API
app.use("/api", routes);

// Servir arquivos estáticos da pasta 'frontend'
app.use(express.static(path.join(__dirname, "frontend")));

// Rota de fallback: Se o usuário acessar uma URL que não existe, manda para o login
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "login.html"));
});

// Configuração da Porta exigida pela Hostinger
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
