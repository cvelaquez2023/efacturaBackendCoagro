const express = require("express");
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

const router = express.Router();

// Todos los endpoints de facturacion de rutas: solo usuarios con rol Admin.
router.use(authMiddleware, checkRol(["Admin"]));

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
router.use("/bodegaAsocRt", require("./bodegaAsocRt"));
router.use("/consecutivoCiErp", require("./consecutivoCiErp"));
router.use("/clienteAsocRt", require("./clienteAsocRt"));
router.use("/agenteAsocRt", require("./agenteAsocRt"));
router.use("/rutaAsignadaRt", require("./rutaAsignadaRt"));
router.use("/rutaCliente", require("./rutaCliente"));

module.exports = router;
