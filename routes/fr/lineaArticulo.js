const express = require("express");

const { getLineasArticulo } = require("../../controllers/fr/lineaArticulo");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getLineasArticulo);

module.exports = router;
