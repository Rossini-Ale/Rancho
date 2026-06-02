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
  const novaCols = [
    ["raca", "VARCHAR(120) NULL"],
    ["pelagem", "VARCHAR(100) NULL"],
    ["data_entrada", "DATE NULL"],
    ["valor_mensalidade_padrao", "DECIMAL(10,2) NULL"],
  ];
  for (const [col, def] of novaCols) {
    try {
      const [[{ cnt }]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Cavalos' AND COLUMN_NAME=?",
        [col],
      );
      if (!cnt) {
        await pool.query(`ALTER TABLE Cavalos ADD COLUMN \`${col}\` ${def}`);
        console.log(`Migração: coluna '${col}' criada.`);
      }
    } catch (e) {
      console.error(`Migração (${col}):`, e.message);
    }
  }
}

const PORT = process.env.PORT || 3000;
runMigrations().then(() => {
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Servidor HF Controll v2 rodando em: http://localhost:${PORT}`),
  );
});
