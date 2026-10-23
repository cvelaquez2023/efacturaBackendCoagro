const express = require("express");

const {
  getReporteVisitas,
  getResumenVisitas,
} = require("../../controllers/fr/reporteVisita");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getReporteVisitas);
router.get("/resumen", authMiddleware, checkRol(["Admin", "Fr"]), getResumenVisitas);

module.exports = router;
