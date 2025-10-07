// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Token em falta." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ error: "Utilizador não encontrado." });
    }

    next();
  } catch (err) {
    console.error("Erro no auth middleware:", err);
    res.status(401).json({ error: "Não autorizado." });
  }
}

module.exports = auth;
