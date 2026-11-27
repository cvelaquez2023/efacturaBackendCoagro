const express = require("express");

const { getInventariosCliente, getInventarioCliente } = require("../../controllers/fr/inventarioCliente");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

// Solo consulta: los inventarios del cliente los crea la app movil (POST /fr/sync/enviar, inventarios).
router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getInventariosCliente);
router.get("/:cia/:ruta/:inventario", authMiddleware, checkRol(["Admin", "Fr"]), getInventarioCliente);

module.exports = router;
