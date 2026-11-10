// Sincronizacion de la handheld. Exige el token de POST /fr/mobile/login
// (header Authorization: Bearer <token>) y rol RUTA. Las rutas salen de la
// handheld del token (RUTA_ASIGNADA_RT), no de la URL.
// Queda como GET /fr/sync/clientes, /clientesCia, /articulos, /lotes, /precios, /cobros, /cobrosAgente, /consecutivos, /configuracion, /cotizaciones, /historialPedidos, /historialFacturas,
// /historialPedidosRuta y /historialFacturasRuta,
// y POST /fr/sync/enviar (la handheld sube lo registrado sin conexion).

const { Router } = require("express");
const compression = require("compression");
const mobileSession = require("../../middleware/mobileSession");
const checkRol = require("../../middleware/rol");
const {
  getSyncClientes,
  getSyncArticulos,
  getSyncCobros,
  getSyncCobrosAgente,
  getSyncConsecutivos,
  getSyncConfiguracion,
  getSyncClientesCia,
  getSyncPrecios,
  getSyncCotizaciones,
  getSyncHistorialPedidos,
  getSyncHistorialFacturas,
  getSyncHistorialPedidosRuta,
  getSyncHistorialFacturasRuta,
  getSyncLotes,
} = require("../../controllers/fr/sync");
const { postSyncEnviar } = require("../../controllers/fr/syncEnviar");

const router = Router();

// Gzip solo para la sincronizacion de la handheld (las respuestas son grandes y repetitivas).
router.use(compression());
// Todos los endpoints de datos: solo usuarios con rol RUTA.
router.use(mobileSession, checkRol(["RUTA"]));

router.get("/clientes", getSyncClientes);
router.get("/articulos", getSyncArticulos);
router.get("/lotes", getSyncLotes);
router.get("/cobros", getSyncCobros);
router.get("/cobrosAgente", getSyncCobrosAgente);
router.get("/consecutivos", getSyncConsecutivos);
router.get("/configuracion", getSyncConfiguracion);
router.get("/clientesCia", getSyncClientesCia);
router.get("/precios", getSyncPrecios);
router.get("/cotizaciones", getSyncCotizaciones);
router.get("/historialPedidos", getSyncHistorialPedidos);
router.get("/historialFacturas", getSyncHistorialFacturas);
router.get("/historialPedidosRuta", getSyncHistorialPedidosRuta);
router.get("/historialFacturasRuta", getSyncHistorialFacturasRuta);
router.post("/enviar", postSyncEnviar);

module.exports = router;
