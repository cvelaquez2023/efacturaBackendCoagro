const {
  rutaAsignadaRtModel,
  rutaRtModel,
  agenteAsocRtModel,
  handheldRtModel,
  grupoArticuloRtModel,
  bodegaAsocRtModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const FLAGS_VALIDOS = ["S", "N"];

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: RUTA 4, AGENTE 4, HANDHELD 4, GRUPO_ARTICULO 3, BODEGA 4.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Esa ruta ya tiene una asignacion."];
  }
  return [fallback];
};

// Valida que agente, handheld, grupoArticulo y bodega existan en sus tablas
// correspondientes. Devuelve un mensaje de error o null si todo existe.
const validarReferencias = async ({ agente, handheld, grupoArticulo, bodega }) => {
  if (agente !== undefined) {
    const agenteAsoc = await agenteAsocRtModel.findOne({
      where: { CODIGO: agente },
      raw: true,
    });
    if (!agenteAsoc) {
      return `El agente ${agente} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/agenteAsocRt.`;
    }
  }

  if (handheld !== undefined) {
    const handheldRt = await handheldRtModel.findOne({
      where: { HANDHELD: handheld },
      raw: true,
    });
    if (!handheldRt) {
      return `El handheld ${handheld} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/handheldRt.`;
    }
  }

  if (grupoArticulo !== undefined) {
    const grupo = await grupoArticuloRtModel.findOne({
      where: { GRUPO_ARTICULO: grupoArticulo },
      raw: true,
    });
    if (!grupo) {
      return `El grupo de articulo ${grupoArticulo} no existe en el modulo de rutas.`;
    }
  }

  if (bodega !== undefined) {
    const bodegaAsoc = await bodegaAsocRtModel.findOne({
      where: { CODIGO: bodega },
      raw: true,
    });
    if (!bodegaAsoc) {
      return `La bodega ${bodega} no existe en el modulo de rutas. Dala de alta primero con POST /fr/bodegaAsocRt.`;
    }
  }

  return null;
};

// GET /fr/rutaAsignadaRt?agente=&handheld=&grupoArticulo=&bodega=&activa=&page=1&limit=20
const getRutasAsignadasRt = async (req, res) => {
  try {
    const { agente, handheld, grupoArticulo, bodega, activa } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (agente) where.AGENTE = agente;
    if (handheld) where.HANDHELD = handheld;
    if (grupoArticulo) where.GRUPO_ARTICULO = grupoArticulo;
    if (bodega) where.BODEGA = bodega;
    if (activa) where.ACTIVA = activa;

    const data = await rutaAsignadaRtModel.findAndCountAll({
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
      errors: parseErrores(error, "Error al consultar las asignaciones de ruta"),
    });
  }
};

// GET /fr/rutaAsignadaRt/:ruta
const getRutaAsignadaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaAsignadaRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la asignacion de la ruta"),
    });
  }
};

// POST /fr/rutaAsignadaRt
// { ruta, agente, handheld, grupoArticulo, bodega, activa }
// Asigna una ruta (ya existente en RUTA_RT) a un agente (AGENTE_ASOC_RT),
// un handheld (HANDHELD_RT), un grupo de articulos (GRUPO_ARTICULO_RT) y una
// bodega (BODEGA_ASOC_RT). Relacion 1:1: una ruta solo puede tener una
// asignacion (la PK real en BD es RUTA).
const postRutaAsignadaRt = async (req, res) => {
  try {
    const { ruta, agente, handheld, grupoArticulo, bodega, activa } = req.body;

    if (!ruta || !agente || !handheld || !grupoArticulo || !bodega) {
      return res.send({
        result: {},
        success: false,
        errors: [
          "Los campos ruta, agente, handheld, grupoArticulo y bodega son obligatorios",
        ],
      });
    }

    if (activa && !FLAGS_VALIDOS.includes(activa)) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo activa debe ser S o N"],
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

    const rutaYaAsignada = await rutaAsignadaRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    if (rutaYaAsignada) {
      return res.send({
        result: {},
        success: false,
        errors: [`La ruta ${ruta} ya tiene una asignacion.`],
      });
    }

    const errorReferencias = await validarReferencias({
      agente,
      handheld,
      grupoArticulo,
      bodega,
    });
    if (errorReferencias) {
      return res.send({ result: {}, success: false, errors: [errorReferencias] });
    }

    const data = await rutaAsignadaRtModel.create({
      RUTA: ruta,
      AGENTE: agente,
      HANDHELD: handheld,
      GRUPO_ARTICULO: grupoArticulo,
      BODEGA: bodega,
      COMPANIA: null, // el sistema no maneja companias
      ACTIVA: activa || "S",
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la asignacion de ruta"),
    });
  }
};

// PUT /fr/rutaAsignadaRt/:ruta
// { agente, handheld, grupoArticulo, bodega, activa }
const putRutaAsignadaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const { agente, handheld, grupoArticulo, bodega, activa } = req.body;

    if (activa && !FLAGS_VALIDOS.includes(activa)) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo activa debe ser S o N"],
      });
    }

    const actual = await rutaAsignadaRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`La ruta ${ruta} no tiene una asignacion en el modulo de rutas.`],
      });
    }

    const errorReferencias = await validarReferencias({
      agente,
      handheld,
      grupoArticulo,
      bodega,
    });
    if (errorReferencias) {
      return res.send({ result: {}, success: false, errors: [errorReferencias] });
    }

    const cambios = {};
    if (agente !== undefined) cambios.AGENTE = agente;
    if (handheld !== undefined) cambios.HANDHELD = handheld;
    if (grupoArticulo !== undefined) cambios.GRUPO_ARTICULO = grupoArticulo;
    if (bodega !== undefined) cambios.BODEGA = bodega;
    if (activa !== undefined) cambios.ACTIVA = activa;

    const data = await rutaAsignadaRtModel.update(cambios, {
      where: { RUTA: ruta },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la asignacion de ruta"),
    });
  }
};

// DELETE /fr/rutaAsignadaRt/:ruta
const deleteRutaAsignadaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaAsignadaRtModel.destroy({
      where: { RUTA: ruta },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asignacion de ruta"),
    });
  }
};

module.exports = {
  getRutasAsignadasRt,
  getRutaAsignadaRt,
  postRutaAsignadaRt,
  putRutaAsignadaRt,
  deleteRutaAsignadaRt,
};
