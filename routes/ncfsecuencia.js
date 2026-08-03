const express = require("express");

const { getNCFsecuencia } = require("../controllers/NCFsecuencia");

const router = express.Router();

router.get("/:prefijo", getNCFsecuencia);
module.exports = router;
