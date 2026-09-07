const express = require("express");
const router = express.Router();

router.use("/visita", require("./visita"));
router.use("/globalesRuteo", require("./globalesRuteo"));
router.use("/grupoArticuloRt", require("./grupoArticuloRt"));
router.use("/handheldRt", require("./handheldRt"));
router.use("/rutaRt", require("./rutaRt"));
router.use("/clienteRt", require("./clienteRt"));
router.use("/articuloRt", require("./articuloRt"));
router.use("/clienteErp", require("./clienteErp"));
router.use("/articuloErp", require("./articuloErp"));
router.use("/grupoArtAsocRt", require("./grupoArtAsocRt"));
router.use("/vendedorErp", require("./vendedorErp"));
router.use("/agenteRt", require("./agenteRt"));
router.use("/bodegaErp", require("./bodegaErp"));
router.use("/bodegaRt", require("./bodegaRt"));

module.exports = router;
