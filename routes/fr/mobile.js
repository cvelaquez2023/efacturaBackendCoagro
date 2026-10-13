// App movil (handheld).
// Sin sesion:   POST /fr/mobile/registro, POST /fr/mobile/login
// Con sesion:   GET  /fr/mobile/sesion, GET /fr/mobile/dte/:dte/pdf  (token movil + rol RUTA)

const { Router } = require("express");
const mobileSession = require("../../middleware/mobileSession");
const checkRol = require("../../middleware/rol");
const { postRegistro, postLogin, getSesion } = require("../../controllers/fr/mobile");
const { getDtePdf } = require("../../controllers/fr/mobileDte");

const router = Router();
const soloRuta = [mobileSession, checkRol(["RUTA"])];

router.post("/registro", postRegistro);
router.post("/login", postLogin);
router.get("/sesion", ...soloRuta, getSesion);
router.get("/dte/:dte/pdf", ...soloRuta, getDtePdf);

module.exports = router;
