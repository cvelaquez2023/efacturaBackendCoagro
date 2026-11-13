const express = require("express");

const {
  getLideres,
  getLider,
  postLider,
  putLider,
  deleteLider,
} = require("../../controllers/fr/lider");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getLideres);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getLider);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postLider);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putLider);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deleteLider);

module.exports = router;
