const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const connection = mysql.createConnection({
  host: "localhost",
  user: "horta_app",
  password: "senha_super_segura",
  database: "rancho_db",
});

const novoUsuario = {
  nome: "Alexandre",
  username: "Alexandre",
  email: "admin@rancho.com",
  senhaOriginal: "1234",
};

async function criar() {
  console.log("Criptografando senha...");

  // Criptografa a senha
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(novoUsuario.senhaOriginal, salt);

  const sql = `INSERT INTO users (nome, username, email, password) VALUES (?, ?, ?, ?)`;

  connection.execute(
    sql,
    [novoUsuario.nome, novoUsuario.username, novoUsuario.email, hash],
    (err, results) => {
      if (err) {
        console.error("Erro ao criar usuário:", err.message);
      } else {
        console.log("✅ Usuário criado com sucesso!");
        console.log(`Login: ${novoUsuario.username}`);
        console.log(`Senha: ${novoUsuario.senhaOriginal}`);
      }
      connection.end();
    },
  );
}

criar();
