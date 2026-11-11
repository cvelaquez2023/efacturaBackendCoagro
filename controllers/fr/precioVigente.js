const { obtenerPrecioVigente, hoyISO } = require("../../utils/precioFr");

/**
 * GET /fr/precioVigente?articulo=&cliente=&fecha=YYYY-MM-DD&cantidad=&ruta=&tipoCliente=&nivelPrecio=
 *
 * - articulo: obligatorio.
 * - cliente: para su nivel de precio (erpadmin.cliente) y sus condiciones especiales.
 * - nivelPrecio: opcional, fuerza el nivel (si no hay cliente o para comparar).
 * - ruta: una o varias separadas por coma; para promociones dirigidas a rutas.
 * - tipoCliente: para promociones dirigidas a tipos de cliente (aun no hay tabla).
 * - fecha: hoy por defecto. cantidad: 1 por defecto (para CANTIDAD_MIN).
 *
 * La regla esta en utils/precioFr.js (la misma que usara la app).
 */
const getPrecioVigente = async (req, res) => {
  try {
    const articulo = String(req.query.articulo || "").trim();
    if (!articulo) {
      return res.send({ result: {}, success: false, errors: ["El parametro articulo es obligatorio"] });
    }

    const fecha = String(req.query.fecha || hoyISO()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.send({ result: {}, success: false, errors: ["fecha debe tener formato YYYY-MM-DD"] });
    }

    const cantidad = req.query.cantidad === undefined ? 1 : Number(req.query.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return res.send({ result: {}, success: false, errors: ["cantidad debe ser un numero mayor que 0"] });
    }

    const rutas = String(req.query.ruta || "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const data = await obtenerPrecioVigente({
      articulo,
      cliente: String(req.query.cliente || "").trim() || undefined,
      fecha,
      cantidad,
      rutas,
      tipoCliente: String(req.query.tipoCliente || "").trim() || undefined,
      nivelPrecio: String(req.query.nivelPrecio || "").trim() || undefined,
    });

    if (data.error) {
      return res.send({ result: {}, success: false, errors: [data.error] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al calcular el precio vigente"] });
  }
};

module.exports = { getPrecioVigente };
