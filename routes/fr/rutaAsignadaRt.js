const express = require("express");

const {
  getRutasAsignadasRt,
  getRutaAsignadaRt,
  postRutaAsignadaRt,
  putRutaAsignadaRt,
  deleteRutaAsignadaRt,
} = require("../../controllers/fr/rutaAsignadaRt");

const router = express.Router();

router.get("/", getRutasAsignadasRt);
router.get("/:ruta", getRutaAsignadaRt);
router.post("/", postRutaAsignadaRt);
router.put("/:ruta", putRutaAsignadaRt);
router.delete("/:ruta", deleteRutaAsignadaRt);

module.exports = router;
