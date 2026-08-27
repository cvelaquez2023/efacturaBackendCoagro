const express = require("express");
const router = express.Router();

router.use("/visita", require("./visita"));
router.use("/globalesRuteo", require("./globalesRuteo"));

module.exports = router;
