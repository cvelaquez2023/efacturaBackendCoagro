const express = require("express");
const { getCentroCosto } = require("../controllers/centroCosto");

const router = express.Router();

router.get("/", getCentroCosto);
module.exports = router;
