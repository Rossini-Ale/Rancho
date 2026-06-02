const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Arquivos estáticos
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rotas
const authRoutes = require("./routes/auth");
const gestaoRoutes = require("./routes/gestao");
const dashboardRoutes = require("./routes/dashboard");

app.use("/api/auth", authRoutes);
app.use("/api/gestao", gestaoRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Redireciona raiz para login
app.get("/", (req, res) => res.redirect("/login.html"));

process.on("uncaughtException", (err) =>
  console.error("Exceção não capturada:", err),
);
process.on("unhandledRejection", (reason, promise) =>
  console.error("Rejeição não tratada:", promise, reason),
);

async function runMigrations() {
  const pool = require("./config/db");
  const cols = [
    "ALTER TABLE Cavalos ADD COLUMN IF NOT EXISTS raca VARCHAR(120) NULL",
    "ALTER TABLE Cavalos ADD COLUMN IF NOT EXISTS pelagem VARCHAR(100) NULL",
    "ALTER TABLE Cavalos ADD COLUMN IF NOT EXISTS data_entrada DATE NULL",
    "ALTER TABLE Cavalos ADD COLUMN IF NOT EXISTS valor_mensalidade_padrao DECIMAL(10,2) NULL",
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (e) { console.error("Migração:", e.message); }
  }
}
runMigrations();

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Servidor HF Controll v2 rodando em: http://localhost:${PORT}`),
);
