const express = require("express");

const {
  getRutasCliente,
  getRutaCliente,
  postRutaCliente,
  putRutaCliente,
  deleteRutaCliente,
} = require("../../controllers/fr/rutaCliente");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getRutasCliente);
router.get("/:ruta/:cliente/:dia", authMiddleware, checkRol(["Admin", "Fr"]), getRutaCliente);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postRutaCliente);
router.put("/:ruta/:cliente/:dia", authMiddleware, checkRol(["Admin", "Fr"]), putRutaCliente);
router.delete("/:ruta/:cliente/:dia", authMiddleware, checkRol(["Admin", "Fr"]), deleteRutaCliente);

module.exports = router;
