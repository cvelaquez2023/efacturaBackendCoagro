const express = require("express");

const {
  getBodegasRt,
  getBodegaRt,
  postBodegaRt,
  putBodegaRt,
  deleteBodegaRt,
} = require("../../controllers/fr/bodegaRt");

const router = express.Router();

router.get("/", getBodegasRt);
router.get("/:bodega", getBodegaRt);
router.post("/", postBodegaRt);
router.put("/:bodega", putBodegaRt);
router.delete("/:bodega", deleteBodegaRt);

module.exports = router;
