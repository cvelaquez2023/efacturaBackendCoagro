const { bodegaRtModel, bodegaErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido en la base de datos."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una bodega con ese codigo."];
  }
  return [fallback];
};

const getBodegasRt = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const data = await bodegaRtModel.findAndCountAll({
      limit,
      offset,
      order: [["BODEGA", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar las bodegas"),
    });
  }
};

const getBodegaRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const data = await bodegaRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la bodega"),
    });
  }
};

// POST /fr/bodegaRt
// Toma una bodega que YA existe en el ERP (schema CINCOH, seleccionada del
// GET /fr/bodegaErp) y la da de alta en el modulo de rutas.
const postBodegaRt = async (req, res) => {
  try {
    const { bodega } = req.body;

    if (!bodega) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo bodega es obligatorio"],
      });
    }

    const bodegaErp = await bodegaErpModel.findOne({
      attributes: ["BODEGA", "NOMBRE"],
      where: { BODEGA: bodega },
      raw: true,
    });

    if (!bodegaErp) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `La bodega ${bodega} no existe en el ERP. Creela primero con el CRUD de bodegas.`,
        ],
      });
    }

    const yaExiste = await bodegaRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    if (yaExiste) {
      return res.send({
        result: {},
        success: false,
        errors: [`La bodega ${bodega} ya esta registrada en el modulo de rutas.`],
      });
    }

    const data = await bodegaRtModel.create({
      BODEGA: bodegaErp.BODEGA,
      NOMBRE: bodegaErp.NOMBRE,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la bodega"),
    });
  }
};

const putBodegaRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const { nombre } = req.body;

    const data = await bodegaRtModel.update(
      { NOMBRE: nombre },
      { where: { BODEGA: bodega } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la bodega"),
    });
  }
};

const deleteBodegaRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const data = await bodegaRtModel.destroy({
      where: { BODEGA: bodega },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la bodega"),
    });
  }
};

module.exports = {
  getBodegasRt,
  getBodegaRt,
  postBodegaRt,
  putBodegaRt,
  deleteBodegaRt,
};
