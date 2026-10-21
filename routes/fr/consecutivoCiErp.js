const express = require("express");

const {
  getConsecutivosCiErp,
  getConsecutivoCiErp,
} = require("../../controllers/fr/consecutivoCiErp");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getConsecutivosCiErp);
router.get("/:consecutivo", authMiddleware, checkRol(["Admin", "Fr"]), getConsecutivoCiErp);

module.exports = router;
