const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Pega "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: "Acesso negado. Faça login." });
  }

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Salva o ID do usuário na requisição para usar nas rotas
    req.user = decoded;

    next();
  } catch (error) {
    res.status(403).json({ message: "Token inválido ou expirado." });
  }
};
