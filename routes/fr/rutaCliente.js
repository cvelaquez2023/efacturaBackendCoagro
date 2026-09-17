const express = require("express");

const {
  getRutasCliente,
  getRutaCliente,
  postRutaCliente,
  putRutaCliente,
  deleteRutaCliente,
} = require("../../controllers/fr/rutaCliente");

const router = express.Router();

router.get("/", getRutasCliente);
router.get("/:ruta/:cliente/:dia", getRutaCliente);
router.post("/", postRutaCliente);
router.put("/:ruta/:cliente/:dia", putRutaCliente);
router.delete("/:ruta/:cliente/:dia", deleteRutaCliente);

module.exports = router;
