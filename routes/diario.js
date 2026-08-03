const express = require("express");

const {
  getDiario,
  postDiario,
  deleteDiario,
  postAsientoLinea,
} = require("../controllers/diario");

const router = express.Router();

router.get("/:asiento", getDiario);
router.post("/lineas", postAsientoLinea);
router.post("/", postDiario);

router.delete("/:cons/:asiento", deleteDiario);
module.exports = router;
