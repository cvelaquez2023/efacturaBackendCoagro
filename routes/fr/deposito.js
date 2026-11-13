const express = require("express");

const { getDepositos, getDeposito, getDocumentosPagados } = require("../../controllers/fr/deposito");
const { getReciboPdf } = require("../../controllers/fr/reciboPdf");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getDepositos);
// Antes de /:consecDep para que "documentos" no se tome como consecutivo.
router.get("/documentos", authMiddleware, checkRol(["Admin", "Fr"]), getDocumentosPagados);
router.get("/:consecDep/pdf", authMiddleware, checkRol(["Admin", "Fr"]), getReciboPdf);
router.get("/:consecDep", authMiddleware, checkRol(["Admin", "Fr"]), getDeposito);

module.exports = router;
