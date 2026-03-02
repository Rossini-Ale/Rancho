const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir arquivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Importação das Rotas
const indexRoutes = require("./routes/index");
const authRoutes = require("./routes/auth");
const gestaoRoutes = require("./routes/gestao");

// Definição das Rotas
app.use("/", indexRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/gestao", gestaoRoutes);

// Tratamento de erros não capturados para evitar queda do processo
process.on("uncaughtException", (err) => {
  console.error("Exceção não capturada:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Rejeição não tratada em:", promise, "motivo:", reason);
});

// CONFIGURAÇÃO DE PORTA PARA HOSTINGER
// A Hostinger define a porta dinamicamente; se não houver, usa 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Rancho rodando em: http://localhost:${PORT}`);
});
