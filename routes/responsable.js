const express = require("express");
const { getResponsable } = require("../controllers/Empleado");

const router = express.Router();

router.get("/", getResponsable);

module.exports = router;
