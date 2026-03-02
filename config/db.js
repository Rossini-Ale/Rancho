const mysql = require("mysql2/promise");
require("dotenv").config();

// Configurações de banco de dados otimizadas para Hostinger
const dbConfig = {
  host: process.env.DB_HOST || "localhost", // Hostinger geralmente usa localhost
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Verificação de conexão simplificada para evitar crash silencioso no log da Hostinger
pool
  .getConnection()
  .then((conn) => {
    console.log("Banco de Dados Conectado com sucesso!");
    conn.release();
  })
  .catch((err) => {
    console.error(
      "Erro Crítico: Não foi possível conectar ao banco de dados:",
      err.message,
    );
  });

module.exports = pool;
