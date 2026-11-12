const express = require("express");

const { getDepositos, getDeposito } = require("../../controllers/fr/deposito");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getDepositos);
router.get("/:consecDep", authMiddleware, checkRol(["Admin", "Fr"]), getDeposito);

module.exports = router;
