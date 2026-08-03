const express = require("express");
const { getConceptoVale } = require("../controllers/conceptoVale");

const router = express.Router();

router.get("/", getConceptoVale);
module.exports = router;
