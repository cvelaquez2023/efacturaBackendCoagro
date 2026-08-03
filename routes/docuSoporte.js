const express = require("express");

const { postdocsSoporte } = require("../controllers/docsSoporte");
const { postdocsSoporte14 } = require("../controllers/docsSoporte14");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

const router = express.Router();

router.post("/",authMiddleware, checkRol(["Admin"]), postdocsSoporte);
router.post("/dte14",authMiddleware, checkRol(["Admin"]), postdocsSoporte14);

module.exports = router;
