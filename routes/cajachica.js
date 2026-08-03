const express = require("express");
const { getCajaChica } = require("../controllers/cajaChica");

const router = express.Router();

router.get("/", getCajaChica);
module.exports = router;
