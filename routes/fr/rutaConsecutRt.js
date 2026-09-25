const express = require("express");

const {
  getRutasConsecutRt,
  getRutaConsecutRt,
  postRutaConsecutRt,
  putRutaConsecutRt,
  deleteRutaConsecutRt,
} = require("../../controllers/fr/rutaConsecutRt");

const router = express.Router();

router.get("/", getRutasConsecutRt);
router.get("/:ruta", getRutaConsecutRt);
router.post("/", postRutaConsecutRt);
router.put("/:ruta", putRutaConsecutRt);
router.delete("/:ruta", deleteRutaConsecutRt);

module.exports = router;
