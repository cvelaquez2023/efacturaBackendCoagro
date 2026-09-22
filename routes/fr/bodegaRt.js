const express = require("express");

const {
  getBodegasRt,
  getBodegaRt,
  postBodegaRt,
  putBodegaRt,
  deleteBodegaRt,
} = require("../../controllers/fr/bodegaRt");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getBodegasRt);
router.get("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), getBodegaRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postBodegaRt);
router.put("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), putBodegaRt);
router.delete("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), deleteBodegaRt);

module.exports = router;
