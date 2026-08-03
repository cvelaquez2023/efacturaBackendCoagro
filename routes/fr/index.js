const express = require("express");
const router = express.Router();

router.use("/visita", require("./visita"));

module.exports = router;
