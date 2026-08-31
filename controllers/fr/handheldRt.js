const { handheldRtModel } = require("../../models");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = "String or binary data would be truncated" -> valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: HANDHELD 4, DESCRIPCION 40, SERIE 15, MODELO 15, ESTADO 1, FIRMA 2048.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un handheld con ese codigo."];
  }
  return [fallback];
};

const getHandheldsRt = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = {};
    if (estado) where.ESTADO = estado;

    const data = await handheldRtModel.findAll({ where, raw: true });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los handhelds"),
    });
  }
};

const getHandheldRt = async (req, res) => {
  const { handheld } = req.params;
  try {
    const data = await handheldRtModel.findOne({
      where: { HANDHELD: handheld },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar el handheld"),
    });
  }
};

const postHandheldRt = async (req, res) => {
  try {
    const { handheld, descripcion, serie, modelo, estado, firma } = req.body;

    const data = await handheldRtModel.create({
      HANDHELD: handheld,
      DESCRIPCION: descripcion,
      SERIE: serie,
      MODELO: modelo,
      ESTADO: estado,
      FIRMA: firma,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear el handheld"),
    });
  }
};

const putHandheldRt = async (req, res) => {
  const { handheld } = req.params;
  try {
    const { descripcion, serie, modelo, estado, firma } = req.body;

    const data = await handheldRtModel.update(
      {
        DESCRIPCION: descripcion,
        SERIE: serie,
        MODELO: modelo,
        ESTADO: estado,
        FIRMA: firma,
      },
      { where: { HANDHELD: handheld } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar el handheld"),
    });
  }
};

const deleteHandheldRt = async (req, res) => {
  const { handheld } = req.params;
  try {
    const data = await handheldRtModel.destroy({
      where: { HANDHELD: handheld },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar el handheld"),
    });
  }
};

module.exports = {
  getHandheldsRt,
  getHandheldRt,
  postHandheldRt,
  putHandheldRt,
  deleteHandheldRt,
};
