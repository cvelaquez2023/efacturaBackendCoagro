const express = require("express");

const {
  getBodegasAsocRt,
  getBodegaAsocRt,
  postBodegaAsocRt,
  putBodegaAsocRt,
  putRestablecerBodegaAsocRt,
  deleteBodegaAsocRt,
} = require("../../controllers/fr/bodegaAsocRt");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getBodegasAsocRt);
router.get("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), getBodegaAsocRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postBodegaAsocRt);
router.put("/:bodega/restablecer", authMiddleware, checkRol(["Admin", "Fr"]), putRestablecerBodegaAsocRt);
router.put("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), putBodegaAsocRt);
router.delete("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), deleteBodegaAsocRt);

module.exports = router;
