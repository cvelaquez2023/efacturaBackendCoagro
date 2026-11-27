// App movil (handheld).
// Sin sesion:   POST /fr/mobile/registro, POST /fr/mobile/login
// Con sesion:   GET  /fr/mobile/sesion, GET /fr/mobile/dte/:dte/pdf,
//               GET /fr/mobile/cotizacion/:cia/:pedido/pdf,
//               GET /fr/mobile/recibo/:numDep/pdf[?ctaBco=&numDoc=],
//               GET /fr/mobile/fichaArticulo, GET /fr/mobile/fichaArticulo/:articulo/pdf
//               (token movil + rol RUTA)

const { Router } = require("express");
const mobileSession = require("../../middleware/mobileSession");
const checkRol = require("../../middleware/rol");
const { postRegistro, postLogin, getSesion } = require("../../controllers/fr/mobile");
const { getDtePdf } = require("../../controllers/fr/mobileDte");
const { getCotizacionPdfMovil } = require("../../controllers/fr/cotizacionPdf");
const { getReciboPdfMovil } = require("../../controllers/fr/reciboPdf");
const {
  getFichasArticuloMovil,
  getFichaArticuloPdf,
} = require("../../controllers/fr/fichaArticulo");

const router = Router();
const soloRuta = [mobileSession, checkRol(["RUTA"])];

router.post("/registro", postRegistro);
router.post("/login", postLogin);
router.get("/sesion", ...soloRuta, getSesion);
router.get("/dte/:dte/pdf", ...soloRuta, getDtePdf);
router.get("/cotizacion/:cia/:pedido/pdf", ...soloRuta, getCotizacionPdfMovil);
router.get("/recibo/:numDep/pdf", ...soloRuta, getReciboPdfMovil);
router.get("/fichaArticulo", ...soloRuta, getFichasArticuloMovil);
router.get("/fichaArticulo/:articulo/pdf", ...soloRuta, getFichaArticuloPdf);

module.exports = router;
