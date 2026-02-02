// Arquivo: server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Servir os arquivos do Frontend (HTML, CSS, JS) estaticamente
app.use(express.static(path.join(__dirname, "frontend")));

// Rotas da API
app.use("/api", require("./routes/index"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sistema Rancho rodando em: http://localhost:${PORT}/login.html`);
});
