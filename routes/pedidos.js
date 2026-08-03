const express = require("express");
const router = express.Router();
const { getPedido } = require("../controllers/pedido");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

router.post("/", authMiddleware, checkRol(["User","Admin"]), getPedido);

module.exports = router;
