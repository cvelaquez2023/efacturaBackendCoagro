const express = require("express");

const { getDepartamento } = require("../controllers/departamento");

const router = express.Router();

router.get("/", getDepartamento);
module.exports = router;
