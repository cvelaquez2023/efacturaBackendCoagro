const express = require("express");
const { getCondPago } = require("../controllers/condicionpago");

const router = express.Router();

router.get("/", getCondPago);
module.exports = router;
