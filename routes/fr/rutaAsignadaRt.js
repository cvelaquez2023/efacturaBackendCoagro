const express = require("express");

const {
  getRutasAsignadasRt,
  getRutaAsignadaRt,
  postRutaAsignadaRt,
  putRutaAsignadaRt,
  deleteRutaAsignadaRt,
} = require("../../controllers/fr/rutaAsignadaRt");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getRutasAsignadasRt);
router.get("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), getRutaAsignadaRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postRutaAsignadaRt);
router.put("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), putRutaAsignadaRt);
router.delete("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), deleteRutaAsignadaRt);

module.exports = router;
