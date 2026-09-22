const express = require("express");

const {
  getVendedoresErp,
  getVendedorErp,
} = require("../../controllers/fr/vendedorErp");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getVendedoresErp);
router.get("/:vendedor", authMiddleware, checkRol(["Admin", "Fr"]), getVendedorErp);

module.exports = router;
