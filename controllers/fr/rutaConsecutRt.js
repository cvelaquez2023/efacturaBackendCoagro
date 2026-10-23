const { rutaConsecutRtModel, rutaRtModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Columnas de configuracion (todo lo que no es RUTA/COMPANIA), en el mismo
// orden del INFORMATION_SCHEMA real. Se usan para mapear el body camelCase
// (ej pedidoDescuento) a la columna real de BD (PEDIDO_DESCUENTO) sin repetir
// 54 mapeos manuales a mano.
const COLUMNAS = [
  "PEDIDO",
  "RECIBO",
  "DEVOLUCION",
  "FACTURA",
  "INVENTARIO",
  "PEDIDO_DESCUENTO",
  "NOTACREDITO",
  "NCF_CONSUMIDOR_F",
  "NCF_ORGANIZADO",
  "NCF_REGIMEN_ESP",
  "NCF_GUBERNAMENTAL",
  "NCF_DEVOLUCION",
  "NCF_RECIBO",
  "GARANTIA",
  "CONSEC_RESOLUCION_FAC",
  "CONSEC_RESOLUCION_DEV",
  "NCF_CONSUMIDOR_F_SEC",
  "NCF_ORGANIZADO_SEC",
  "NCF_REGIMEN_ESP_SEC",
  "NCF_GUBERNAMENTAL_SEC",
  "NCF_DEVOCULION_SEC",
  "NCF_RECIBO_SEC",
  "OTROCREDITO",
  "NCF_FACTURA_EXP",
  "NCF_FACTURA_EXP_SEC",
  "NCF_CONTING_CRDT_FISCAL",
  "NCF_CONTING_CRDT_FISCAL_SEC",
  "NCF_CONTING_CONSUMO",
  "NCF_CONTING_CONSUMO_SEC",
  "NCF_CONTING_GUBERNAMENTAL",
  "NCF_CONTING_GUBERNAMENTAL_SEC",
  "NCF_CONTING_REGIMEN_ESP",
  "NCF_CONTING_REGIMEN_ESP_SEC",
  "NCF_CONTING_DEVOLUCION",
  "NCF_CONTING_DEVOLUCION_SEC",
  "NCF_CONTING_FACTURA_EXP",
  "NCF_CONTING_FACTURA_EXP_SEC",
  "CREDITO_FISCAL",
  "SUBTIPO_CREDITO_FISCAL",
  "DTE_CREDITO_FISCAL",
  "FACTURA_EXPORTACION",
  "SUBTIPO_FACTURA_EXPORTACION",
  "DTE_FACTURA_EXPORTACION",
  "SUBTIPO_FACTURA",
  "DTE_FACTURA",
  "SUBTIPO_DEVOLUCION",
  "DTE_DEVOLUCION",
  "SUBTIPO_DEVOLUCION_ANULACION",
  "DEVOLUCION_ANULACION",
  "DTE_DEVOLUCION_ANULACION",
  "SUBTIPO_NOTA_CREDITO",
  "DTE_NOTA_CREDITO",
  "SUBTIPO_OTRO_CREDITO",
  "DTE_OTRO_CREDITO",
];

// Las 6 unicas NOT NULL en BD (fuera de RUTA/COMPANIA): deben mandarse en el POST.
const REQUERIDOS = [
  "PEDIDO",
  "RECIBO",
  "DEVOLUCION",
  "FACTURA",
  "INVENTARIO",
  "PEDIDO_DESCUENTO",
];

// NCF_CONTING_CRDT_FISCAL_SEC -> ncfContingCrdtFiscalSec
const dbAJs = (columna) =>
  columna.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido para esa columna (ver largos en models/fr/RutaConsecutRt.js).",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Esa ruta ya tiene consecutivos configurados."];
  }
  return [fallback];
};

// GET /fr/rutaConsecutRt?ruta=&page=1&limit=20
const getRutasConsecutRt = async (req, res) => {
  try {
    const { ruta } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (ruta) where.RUTA = ruta;

    const data = await rutaConsecutRtModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["RUTA", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los consecutivos de ruta"),
    });
  }
};

// GET /fr/rutaConsecutRt/:ruta
const getRutaConsecutRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaConsecutRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los consecutivos de la ruta"),
    });
  }
};

// POST /fr/rutaConsecutRt
// { ruta, pedido, recibo, devolucion, factura, inventario, pedidoDescuento, ...resto opcional }
// Configura los consecutivos/NCF de una ruta ya existente en RUTA_RT. Relacion
// 1:1 (una ruta = una sola configuracion).
const postRutaConsecutRt = async (req, res) => {
  try {
    const { ruta } = req.body;

    if (!ruta) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo ruta es obligatorio"],
      });
    }

    const faltantes = REQUERIDOS.filter(
      (columna) => !req.body[dbAJs(columna)]
    );
    if (faltantes.length > 0) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `Los campos ${faltantes.map(dbAJs).join(", ")} son obligatorios`,
        ],
      });
    }

    const rutaRt = await rutaRtModel.findOne({ where: { RUTA: ruta }, raw: true });
    if (!rutaRt) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `La ruta ${ruta} no existe en el modulo de rutas. Dala de alta primero con POST /fr/rutaRt.`,
        ],
      });
    }

    const yaConfigurada = await rutaConsecutRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    if (yaConfigurada) {
      return res.send({
        result: {},
        success: false,
        errors: [`La ruta ${ruta} ya tiene consecutivos configurados.`],
      });
    }

    const valores = { RUTA: ruta, COMPANIA: null };
    COLUMNAS.forEach((columna) => {
      const valor = req.body[dbAJs(columna)];
      if (valor !== undefined) valores[columna] = valor;
    });

    const data = await rutaConsecutRtModel.create(valores);
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear los consecutivos de ruta"),
    });
  }
};

// PUT /fr/rutaConsecutRt/:ruta
// Body con cualquier subconjunto de los campos de configuracion (camelCase).
// ruta/compania no son editables (compania siempre null, ruta es la PK).
const putRutaConsecutRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const actual = await rutaConsecutRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`La ruta ${ruta} no tiene consecutivos configurados.`],
      });
    }

    const cambios = {};
    COLUMNAS.forEach((columna) => {
      const valor = req.body[dbAJs(columna)];
      if (valor !== undefined) cambios[columna] = valor;
    });

    const data = await rutaConsecutRtModel.update(cambios, {
      where: { RUTA: ruta },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar los consecutivos de ruta"),
    });
  }
};

// DELETE /fr/rutaConsecutRt/:ruta
const deleteRutaConsecutRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaConsecutRtModel.destroy({
      where: { RUTA: ruta },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar los consecutivos de ruta"),
    });
  }
};

module.exports = {
  getRutasConsecutRt,
  getRutaConsecutRt,
  postRutaConsecutRt,
  putRutaConsecutRt,
  deleteRutaConsecutRt,
};
