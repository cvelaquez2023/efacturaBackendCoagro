const express = require("express");
const router = express.Router();

router.use("/visita", require("./visita"));
router.use("/globalesRuteo", require("./globalesRuteo"));
router.use("/grupoArticuloRt", require("./grupoArticuloRt"));
router.use("/handheldRt", require("./handheldRt"));
router.use("/rutaRt", require("./rutaRt"));
router.use("/clienteRt", require("./clienteRt"));

module.exports = router;
