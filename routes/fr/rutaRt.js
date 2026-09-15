const express = require("express");

const {
  getRutasRt,
  getRutaRt,
  postRutaRt,
  putRutaRt,
  deleteRutaRt,
} = require("../../controllers/fr/rutaRt");

const router = express.Router();

router.get("/", getRutasRt);
router.get("/:ruta", getRutaRt);
router.post("/", postRutaRt);
router.put("/:ruta", putRutaRt);
router.delete("/:ruta", deleteRutaRt);

module.exports = router;
