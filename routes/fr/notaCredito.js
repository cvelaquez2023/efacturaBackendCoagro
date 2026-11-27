const express = require("express");

const { getNotasCredito, getNotaCredito } = require("../../controllers/fr/notaCredito");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

// Solo consulta: las notas de credito las crea la app movil (POST /fr/sync/enviar, notasCredito).
router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getNotasCredito);
router.get("/:cia/:ruta/:notaCredito", authMiddleware, checkRol(["Admin", "Fr"]), getNotaCredito);

module.exports = router;
