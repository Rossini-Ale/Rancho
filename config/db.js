const mysql = require("mysql2/promise");
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Teste a conexão imediatamente ao iniciar
pool
  .getConnection()
  .then((conn) => {
    console.log("Conectado ao banco com sucesso!");
    conn.release();
  })
  .catch((err) => {
    console.error("ERRO CRÍTICO NO BANCO:", err.message);
  });

module.exports = pool;
