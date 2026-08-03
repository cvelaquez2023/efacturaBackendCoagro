const express = require("express");
const { getImpuesto } = require("../controllers/impuesto");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

const router = express.Router();

router.get("/", authMiddleware, checkRol(["User", "Admin"]), getImpuesto);
module.exports = router;
