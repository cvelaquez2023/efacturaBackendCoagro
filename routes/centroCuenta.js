const express = require("express");

const { getCentroCuenta, getCentroCuenta2 } = require("../controllers/centroCuenta");

const router = express.Router();

router.get("/costo/:id", getCentroCuenta);
router.get("/cuenta/:id", getCentroCuenta2);
module.exports = router;
