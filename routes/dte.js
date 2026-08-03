const express = require("express");
const {
  postDteProveedor,
  getDteProveedor,
  putDteProveedor,
  cargarCPSoftland,
  getCargaCPSoftland,
  getDteCliente,
  getDteObservaciones,
  getDteDescargarPdf,
  getCliente,
  getProveedor,
  getConsecutivo,
  putConsecutivo,
} = require("../controllers/dte");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");
const router = express.Router();

router.get("/", authMiddleware, checkRol(["User", "Admin"]), getDteProveedor);
router.get(
  "/cliente/:fechaI/:fechaF",
  authMiddleware,
  checkRol(["User", "Admin","FAC"]),
  getDteCliente
);
router.get(
  "/proveedor/:ano/:mes/:tipo",
  authMiddleware,
  checkRol(["User", "Admin"]),
  getProveedor
);
router.get("/observaciones/:dteId", getDteObservaciones);
router.get("/cp/:id", authMiddleware, checkRol(["User", "Admin"]), getCargaCPSoftland);
router.get("/:id", getDteProveedor);
router.put("/:id2/:id3", putDteProveedor);
router.post("/", authMiddleware, checkRol(["User", "Admin"]), postDteProveedor);
router.post("/cp/",authMiddleware,checkRol(["User", "Admin"]), cargarCPSoftland);
router.get("/descargar/:dte", authMiddleware,checkRol(["User", "Admin","FAC"]), getDteDescargarPdf);
router.get("/clientes/:dte", authMiddleware,checkRol(["User", "Admin","FAC"]), getCliente);
router.get("/consecutivo/:consecutivo", authMiddleware,checkRol(["User", "Admin"]), getConsecutivo);
router.post("/consUpdate/:consecutivo",authMiddleware,
  checkRol(["User", "Admin"]), putConsecutivo);

module.exports = router;
