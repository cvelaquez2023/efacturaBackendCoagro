const express = require("express");

const { getMoneda } = require("../controllers/moneda");

const router = express.Router();

router.get("/", getMoneda);
module.exports = router;
