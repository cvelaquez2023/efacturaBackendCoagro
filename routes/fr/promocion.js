const express = require("express");

const {
  getPromociones,
  getPromocion,
  postPromocion,
  putPromocion,
  deletePromocion,
} = require("../../controllers/fr/promocion");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getPromociones);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getPromocion);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postPromocion);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putPromocion);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deletePromocion);

module.exports = router;
