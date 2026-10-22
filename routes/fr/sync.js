// Sincronizacion de la handheld. Exige el token de POST /fr/mobile/login
// (header Authorization: Bearer <token>) y rol RUTA. Las rutas salen de la
// handheld del token (RUTA_ASIGNADA_RT), no de la URL.
// Queda como GET /fr/sync/clientes, /clientesCia, /articulos, /cobros y /consecutivos.

const { Router } = require("express");
const compression = require("compression");
const mobileSession = require("../../middleware/mobileSession");
const checkRol = require("../../middleware/rol");
const {
  getSyncClientes,
  getSyncArticulos,
  getSyncCobros,
  getSyncConsecutivos,
  getSyncClientesCia,
} = require("../../controllers/fr/sync");

const router = Router();

// Gzip solo para la sincronizacion de la handheld (las respuestas son grandes y repetitivas).
router.use(compression());
// Todos los endpoints de datos: solo usuarios con rol RUTA.
router.use(mobileSession, checkRol(["RUTA"]));

router.get("/clientes", getSyncClientes);
router.get("/articulos", getSyncArticulos);
router.get("/cobros", getSyncCobros);
router.get("/consecutivos", getSyncConsecutivos);
router.get("/clientesCia", getSyncClientesCia);

module.exports = router;
