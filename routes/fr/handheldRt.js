const express = require("express");

const {
  getHandheldsRt,
  getHandheldRt,
  postHandheldRt,
  putHandheldRt,
  deleteHandheldRt,
} = require("../../controllers/fr/handheldRt");

const router = express.Router();

router.get("/", getHandheldsRt);
router.get("/:handheld", getHandheldRt);
router.post("/", postHandheldRt);
router.put("/:handheld", putHandheldRt);
router.delete("/:handheld", deleteHandheldRt);

module.exports = router;
