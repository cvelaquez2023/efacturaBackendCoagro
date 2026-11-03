const express = require("express");

const { getPedidos, getPedido } = require("../../controllers/fr/pedido");
const { getCotizacionPdf } = require("../../controllers/fr/cotizacionPdf");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getPedidos);
router.get("/:cia/:pedido", authMiddleware, checkRol(["Admin", "Fr"]), getPedido);
router.get("/:cia/:pedido/pdf", authMiddleware, checkRol(["Admin", "Fr"]), getCotizacionPdf);

module.exports = router;
