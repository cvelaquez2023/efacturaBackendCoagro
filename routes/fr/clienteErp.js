const express = require("express");

const {
  getClientesErp,
  getClienteErp,
} = require("../../controllers/fr/clienteErp");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");


router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getClientesErp);
router.get("/:cliente", authMiddleware, checkRol(["Admin", "Fr"]), getClienteErp);

module.exports = router;
