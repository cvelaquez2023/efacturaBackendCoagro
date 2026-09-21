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

router.get("/", getBodegasAsocRt);
router.get("/:bodega", getBodegaAsocRt);
router.post("/", postBodegaAsocRt);
router.put("/:bodega/restablecer", putRestablecerBodegaAsocRt);
router.put("/:bodega", putBodegaAsocRt);
router.delete("/:bodega", deleteBodegaAsocRt);

module.exports = router;
