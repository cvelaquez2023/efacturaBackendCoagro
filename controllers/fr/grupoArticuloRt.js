const { grupoArticuloRtModel } = require("../../models");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  // Errores de validacion del modelo (ej: largo de GRUPO_ARTICULO)
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = "String or binary data would be truncated" -> valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido en la base de datos. Recuerda: GRUPO_ARTICULO admite un maximo de 3 caracteres.",
    ];
  }
  // Llave primaria duplicada
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un grupo de articulo con ese codigo."];
  }
  return [fallback];
};

const getGruposArticuloRt = async (req, res) => {
  try {
    const data = await grupoArticuloRtModel.findAll({ raw: true });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los grupos de articulo"),
    });
  }
};

const getGrupoArticuloRt = async (req, res) => {
  const { grupoArticulo } = req.params;
  try {
    const data = await grupoArticuloRtModel.findOne({
      where: { GRUPO_ARTICULO: grupoArticulo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar el grupo de articulo"),
    });
  }
};

const postGrupoArticuloRt = async (req, res) => {
  try {
    const { grupoArticulo, descripcion } = req.body;

    const data = await grupoArticuloRtModel.create({
      GRUPO_ARTICULO: grupoArticulo,
      DESCRIPCION: descripcion,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear el grupo de articulo"),
    });
  }
};

const putGrupoArticuloRt = async (req, res) => {
  const { grupoArticulo } = req.params;
  try {
    const { descripcion } = req.body;

    const data = await grupoArticuloRtModel.update(
      {
        DESCRIPCION: descripcion,
      },
      { where: { GRUPO_ARTICULO: grupoArticulo } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar el grupo de articulo"),
    });
  }
};

const deleteGrupoArticuloRt = async (req, res) => {
  const { grupoArticulo } = req.params;
  try {
    const data = await grupoArticuloRtModel.destroy({
      where: { GRUPO_ARTICULO: grupoArticulo },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar el grupo de articulo"),
    });
  }
};

module.exports = {
  getGruposArticuloRt,
  getGrupoArticuloRt,
  postGrupoArticuloRt,
  putGrupoArticuloRt,
  deleteGrupoArticuloRt,
};
