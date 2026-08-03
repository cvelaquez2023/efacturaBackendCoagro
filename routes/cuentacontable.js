const express = require("express");

const { getCuentaContable } = require("../controllers/cuentaContable");

const router = express.Router();

router.get("/", getCuentaContable);
module.exports = router;
