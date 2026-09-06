const { rutaRtModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = "String or binary data would be truncated" -> valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: RUTA 4, DESCRIPCION 40, ACTIVA 1, PERIODICIDAD 1, GRUPO_TELEFONO 4.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una ruta con ese codigo."];
  }
  return [fallback];
};

const getRutasRt = async (req, res) => {
  try {
    const { activa, grupoTelefono } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);
    const where = {};
    if (activa) where.ACTIVA = activa;
    if (grupoTelefono) where.GRUPO_TELEFONO = grupoTelefono;

    const data = await rutaRtModel.findAndCountAll({
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
      errors: parseErrores(error, "Error al consultar las rutas"),
    });
  }
};

const getRutaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaRtModel.findOne({
      where: { RUTA: ruta },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la ruta"),
    });
  }
};

const postRutaRt = async (req, res) => {
  try {
    const { ruta, descripcion, activa, periodicidad, grupoTelefono } = req.body;

    const data = await rutaRtModel.create({
      RUTA: ruta,
      DESCRIPCION: descripcion,
      ACTIVA: activa,
      PERIODICIDAD: periodicidad,
      GRUPO_TELEFONO: grupoTelefono,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la ruta"),
    });
  }
};

const putRutaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const { descripcion, activa, periodicidad, grupoTelefono } = req.body;

    const data = await rutaRtModel.update(
      {
        DESCRIPCION: descripcion,
        ACTIVA: activa,
        PERIODICIDAD: periodicidad,
        GRUPO_TELEFONO: grupoTelefono,
      },
      { where: { RUTA: ruta } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la ruta"),
    });
  }
};

const deleteRutaRt = async (req, res) => {
  const { ruta } = req.params;
  try {
    const data = await rutaRtModel.destroy({
      where: { RUTA: ruta },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la ruta"),
    });
  }
};

module.exports = {
  getRutasRt,
  getRutaRt,
  postRutaRt,
  putRutaRt,
  deleteRutaRt,
};
