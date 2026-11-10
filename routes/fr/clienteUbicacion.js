const express = require("express");

const {
  getClientesUbicacion,
  getClienteUbicacion,
} = require("../../controllers/fr/clienteUbicacion");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getClientesUbicacion);
router.get("/:ruta/:cliente", authMiddleware, checkRol(["Admin", "Fr"]), getClienteUbicacion);

module.exports = router;
