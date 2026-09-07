const { articuloRtModel, articuloErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = "String or binary data would be truncated" -> valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: ARTICULO 20, DESCRIPCION 254, ORDEN_ARTICULO 5, BODEGA 4, LOCALIZACION 4.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un articulo con ese codigo."];
  }
  return [fallback];
};

const getArticulosRt = async (req, res) => {
  try {
    const { bodega } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);
    const where = {};
    if (bodega) where.BODEGA = bodega;
    // if (grupoArticulo) where.GRUPO_ARTICULO = grupoArticulo; // ver ALTER GRUPO_ARTICULO

    const data = await articuloRtModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["ARTICULO", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los articulos"),
    });
  }
};

const getArticuloRt = async (req, res) => {
  const { articulo } = req.params;
  try {
    const data = await articuloRtModel.findOne({
      where: { ARTICULO: articulo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar el articulo"),
    });
  }
};

// POST /fr/articuloRt
// Toma un articulo que YA existe en el ERP (schema CINCOH, seleccionado del
// GET /fr/articuloErp) y lo da de alta en el modulo de rutas.
const postArticuloRt = async (req, res) => {
  try {
    const {
      articulo,
      factorPrecio,
      ordenArticulo,
      bodega,
      localizacion,
    } = req.body;

    if (!articulo) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo articulo es obligatorio"],
      });
    }

    const articuloErp = await articuloErpModel.findOne({
      attributes: ["ARTICULO", "DESCRIPCION"],
      where: { ARTICULO: articulo },
      raw: true,
    });

    if (!articuloErp) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El articulo ${articulo} no existe en el ERP. Creelo primero con el CRUD de articulos.`,
        ],
      });
    }

    const yaExiste = await articuloRtModel.findOne({
      where: { ARTICULO: articulo },
      raw: true,
    });
    if (yaExiste) {
      return res.send({
        result: {},
        success: false,
        errors: [`El articulo ${articulo} ya esta registrado en el modulo de rutas.`],
      });
    }

    const data = await articuloRtModel.create({
      COMPANIA: null, // el sistema no maneja companias
      ARTICULO: articuloErp.ARTICULO,
      DESCRIPCION: articuloErp.DESCRIPCION,
      FACTOR_PRECIO: factorPrecio != null ? factorPrecio : 1,
      ORDEN_ARTICULO: ordenArticulo,
      BODEGA: bodega,
      LOCALIZACION: localizacion,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear el articulo"),
    });
  }
};

const putArticuloRt = async (req, res) => {
  const { articulo } = req.params;
  try {
    const {
      descripcion,
      factorPrecio,
      ordenArticulo,
      bodega,
      localizacion,
    } = req.body;

    const data = await articuloRtModel.update(
      {
        DESCRIPCION: descripcion,
        FACTOR_PRECIO: factorPrecio,
        ORDEN_ARTICULO: ordenArticulo,
        BODEGA: bodega,
        LOCALIZACION: localizacion,
      },
      { where: { ARTICULO: articulo } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar el articulo"),
    });
  }
};

const deleteArticuloRt = async (req, res) => {
  const { articulo } = req.params;
  try {
    const data = await articuloRtModel.destroy({
      where: { ARTICULO: articulo },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar el articulo"),
    });
  }
};

module.exports = {
  getArticulosRt,
  getArticuloRt,
  postArticuloRt,
  putArticuloRt,
  deleteArticuloRt,
};
