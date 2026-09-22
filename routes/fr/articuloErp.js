const express = require("express");

const {
  getArticulosErp,
  getArticuloErp,
} = require("../../controllers/fr/articuloErp");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getArticulosErp);
router.get("/:articulo", authMiddleware, checkRol(["Admin", "Fr"]), getArticuloErp);

module.exports = router;
