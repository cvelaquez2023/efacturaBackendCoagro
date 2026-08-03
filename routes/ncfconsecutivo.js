const express = require("express");
const { getNCFconsecutivo } = require("../controllers/NCFconsecutivo");

const router = express.Router();

router.get("/", getNCFconsecutivo);
module.exports = router;
