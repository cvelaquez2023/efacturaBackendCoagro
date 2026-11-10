const express = require("express");

const {
  getConfigsHh,
  getConfigHh,
  postConfigHh,
  putConfigHh,
  deleteConfigHh,
} = require("../../controllers/fr/configHh");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getConfigsHh);
router.get("/:handheld/:constante", authMiddleware, checkRol(["Admin", "Fr"]), getConfigHh);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postConfigHh);
router.put("/:handheld/:constante", authMiddleware, checkRol(["Admin", "Fr"]), putConfigHh);
router.delete("/:handheld/:constante", authMiddleware, checkRol(["Admin", "Fr"]), deleteConfigHh);

module.exports = router;
