const express = require("express");

const { getPedidos, getPedido } = require("../../controllers/fr/pedido");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getPedidos);
router.get("/:cia/:pedido", authMiddleware, checkRol(["Admin", "Fr"]), getPedido);

module.exports = router;
