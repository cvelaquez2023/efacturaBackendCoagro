const express = require("express");
const router = express.Router();
const { getBuscar } = require("../controllers/buscar");
router.get("/:key", getBuscar);

module.exports = router;
