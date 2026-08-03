const express = require("express");
const { getEmpleado } = require("../controllers/Empleado");

const router = express.Router();

router.get("/", getEmpleado);

module.exports = router;
