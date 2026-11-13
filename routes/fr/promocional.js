const express = require("express");

const {
  getPromocionales,
  getPromocional,
  putProcesarPromocional,
} = require("../../controllers/fr/promocional");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getPromocionales);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getPromocional);
router.put("/:id/procesar", authMiddleware, checkRol(["Admin", "Fr"]), putProcesarPromocional);

module.exports = router;
