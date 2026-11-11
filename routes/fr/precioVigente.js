const express = require("express");

const { getPrecioVigente } = require("../../controllers/fr/precioVigente");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getPrecioVigente);

module.exports = router;
