const express = require("express");

const {
  getHandheldsRt,
  getHandheldRt,
  postHandheldRt,
  putHandheldRt,
  deleteHandheldRt,
  putLiberarHandheldRt,
} = require("../../controllers/fr/handheldRt");

const router = express.Router();

router.get("/", getHandheldsRt);
router.get("/:handheld", getHandheldRt);
router.post("/", postHandheldRt);
router.put("/:handheld/liberar", putLiberarHandheldRt);
router.put("/:handheld", putHandheldRt);
router.delete("/:handheld", deleteHandheldRt);

module.exports = router;
