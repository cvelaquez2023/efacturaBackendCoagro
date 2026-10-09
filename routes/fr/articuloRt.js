const express = require("express");

const {
  getArticulosRt,
  getArticuloRt,
  postArticuloRt,
  putArticuloRt,
  deleteArticuloRt,
} = require("../../controllers/fr/articuloRt");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getArticulosRt);
router.get("/:articulo", authMiddleware, checkRol(["Admin", "Fr"]), getArticuloRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postArticuloRt);
router.put("/:articulo", authMiddleware, checkRol(["Admin", "Fr"]), putArticuloRt);
router.delete("/:articulo", authMiddleware, checkRol(["Admin", "Fr"]), deleteArticuloRt);

module.exports = router;
