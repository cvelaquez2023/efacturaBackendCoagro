const express = require("express");

const {
  getHandheldsRt,
  getHandheldRt,
  postHandheldRt,
  putHandheldRt,
  deleteHandheldRt,
} = require("../../controllers/fr/handheldRt");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getHandheldsRt);
router.get("/:handheld", authMiddleware, checkRol(["Admin", "Fr"]), getHandheldRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postHandheldRt);
router.put("/:handheld", authMiddleware, checkRol(["Admin", "Fr"]), putHandheldRt);
router.delete("/:handheld", authMiddleware, checkRol(["Admin", "Fr"]), deleteHandheldRt);

module.exports = router;
