const express = require("express");

const {
  getRutasRt,
  getRutaRt,
  postRutaRt,
  putRutaRt,
  deleteRutaRt,
} = require("../../controllers/fr/rutaRt");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getRutasRt);
router.get("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), getRutaRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postRutaRt);
router.put("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), putRutaRt);
router.delete("/:ruta", authMiddleware, checkRol(["Admin", "Fr"]), deleteRutaRt);

module.exports = router;
