const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const gestaoRoutes = require("./gestao");

// Rota de Login (aponta para routes/auth.js)
router.use("/auth", authRoutes);

// Rota de Gestão do Rancho (aponta para routes/gestao.js)
router.use("/gestao", gestaoRoutes);

module.exports = router;
