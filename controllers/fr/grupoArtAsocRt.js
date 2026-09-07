const {
  grupoArtAsocRtModel,
  grupoArticuloRtModel,
  articuloRtModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: GRUPO_ARTICULO 3, ARTICULO 20.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ese articulo ya esta asociado a ese grupo."];
  }
  return [fallback];
};

// GET /fr/grupoArtAsocRt?grupoArticulo=XXX  -> articulos de un grupo
// GET /fr/grupoArtAsocRt?articulo=YYY       -> grupos de un articulo
const getGrupoArtAsocRt = async (req, res) => {
  try {
    const { grupoArticulo, articulo } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (grupoArticulo) where.GRUPO_ARTICULO = grupoArticulo;
    if (articulo) where.ARTICULO = articulo;

    const data = await grupoArtAsocRtModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["GRUPO_ARTICULO", "ASC"],
        ["ARTICULO", "ASC"],
      ],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar las asociaciones grupo-articulo"),
    });
  }
};

// POST /fr/grupoArtAsocRt  { grupoArticulo, articulo }
// Asocia un articulo (ya registrado en ARTICULO_RT) a un grupo
// (ya registrado en GRUPO_ARTICULO_RT).
const postGrupoArtAsocRt = async (req, res) => {
  try {
    const { grupoArticulo, articulo } = req.body;

    if (!grupoArticulo || !articulo) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos grupoArticulo y articulo son obligatorios"],
      });
    }

    const grupo = await grupoArticuloRtModel.findOne({
      where: { GRUPO_ARTICULO: grupoArticulo },
      raw: true,
    });
    if (!grupo) {
      return res.send({
        result: {},
        success: false,
        errors: [`El grupo ${grupoArticulo} no existe en el modulo de rutas.`],
      });
    }

    const art = await articuloRtModel.findOne({
      where: { ARTICULO: articulo },
      raw: true,
    });
    if (!art) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El articulo ${articulo} no esta registrado en el modulo de rutas. Dalo de alta primero con POST /fr/articuloRt.`,
        ],
      });
    }

    const yaExiste = await grupoArtAsocRtModel.findOne({
      where: { GRUPO_ARTICULO: grupoArticulo, ARTICULO: articulo },
      raw: true,
    });
    if (yaExiste) {
      return res.send({
        result: {},
        success: false,
        errors: [`El articulo ${articulo} ya esta asociado al grupo ${grupoArticulo}.`],
      });
    }

    const data = await grupoArtAsocRtModel.create({
      GRUPO_ARTICULO: grupoArticulo,
      ARTICULO: articulo,
      COMPANIA: null, // el sistema no maneja companias
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al asociar el articulo al grupo"),
    });
  }
};

// DELETE /fr/grupoArtAsocRt/:grupoArticulo/:articulo
const deleteGrupoArtAsocRt = async (req, res) => {
  const { grupoArticulo, articulo } = req.params;
  try {
    const data = await grupoArtAsocRtModel.destroy({
      where: { GRUPO_ARTICULO: grupoArticulo, ARTICULO: articulo },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asociacion grupo-articulo"),
    });
  }
};

module.exports = {
  getGrupoArtAsocRt,
  postGrupoArtAsocRt,
  deleteGrupoArtAsocRt,
};
