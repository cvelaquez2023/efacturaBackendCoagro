const express = require("express");

const {
  getMetasVentaProducto,
  getMetaVentaProducto,
  postMetaVentaProducto,
  putMetaVentaProducto,
  deleteMetaVentaProducto,
  deletePeriodoMetas,
  actualizarVentasMetas,
  ventasDiarias,
} = require("../../controllers/fr/metaVentaProducto");
const { importarMetasVenta, consultaMetasVenta } = require("../../controllers/fr/metaVentaImportar");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");
const subirExcel = require("../../middleware/subirExcel");

const roles = checkRol(["Admin", "Fr"]);

// Rutas fijas ANTES de /:id para que no las capture el parametro.
// Manual para la web: plantilla, catalogos y periodos cargados.
router.get("/consulta", authMiddleware, roles, consultaMetasVenta);
// Carga masiva desde Excel (form-data "archivo"). ?validar=true = vista previa.
router.post("/importar", authMiddleware, roles, subirExcel("archivo"), importarMetasVenta);
// Borrado de un periodo completo: ?anio=&mes=&vendedor= (o &todos=true).
router.delete("/periodo", authMiddleware, roles, deletePeriodoMetas);
// Boton "Actualizar ventas": ejecuta CINCOH.sp_ActualizarVentaMetaProducto. Body/query: anio?, mes?
router.post("/actualizarVentas", authMiddleware, roles, actualizarVentasMetas);
// Solo lectura: ventas del ERP por vendedor/articulo/dia. ?anio&mes obligatorios, &vendedor &articulo opcionales.
router.get("/ventasDiarias", authMiddleware, roles, ventasDiarias);

router.get("/", authMiddleware, roles, getMetasVentaProducto);
router.get("/:id", authMiddleware, roles, getMetaVentaProducto);
router.post("/", authMiddleware, roles, postMetaVentaProducto);
router.put("/:id", authMiddleware, roles, putMetaVentaProducto);
router.delete("/:id", authMiddleware, roles, deleteMetaVentaProducto);

module.exports = router;
