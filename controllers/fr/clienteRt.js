const { clienteRtModel } = require("../../models");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = "String or binary data would be truncated" -> valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: CLIENTE 20, NOMBRE 150.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un cliente con ese codigo."];
  }
  return [fallback];
};

const getClientesRt = async (req, res) => {
  try {
    const data = await clienteRtModel.findAll({ raw: true });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los clientes"),
    });
  }
};

const getClienteRt = async (req, res) => {
  const { cliente } = req.params;
  try {
    const data = await clienteRtModel.findOne({
      where: { CLIENTE: cliente },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar el cliente"),
    });
  }
};

const postClienteRt = async (req, res) => {
  try {
    const {
      cliente,
      nombre,
      latitud,
      longitud,
      altitud,
      fechaActualizacionUbicacion,
    } = req.body;

    const data = await clienteRtModel.create({
      CLIENTE: cliente,
      NOMBRE: nombre,
      LATITUD: latitud,
      LONGITUD: longitud,
      ALTITUD: altitud,
      FECHA_ACTUALIZACION_UBICACION: fechaActualizacionUbicacion,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear el cliente"),
    });
  }
};

const putClienteRt = async (req, res) => {
  const { cliente } = req.params;
  try {
    const {
      nombre,
      latitud,
      longitud,
      altitud,
      fechaActualizacionUbicacion,
    } = req.body;

    const data = await clienteRtModel.update(
      {
        NOMBRE: nombre,
        LATITUD: latitud,
        LONGITUD: longitud,
        ALTITUD: altitud,
        FECHA_ACTUALIZACION_UBICACION: fechaActualizacionUbicacion,
      },
      { where: { CLIENTE: cliente } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar el cliente"),
    });
  }
};

const deleteClienteRt = async (req, res) => {
  const { cliente } = req.params;
  try {
    const data = await clienteRtModel.destroy({
      where: { CLIENTE: cliente },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar el cliente"),
    });
  }
};

module.exports = {
  getClientesRt,
  getClienteRt,
  postClienteRt,
  putClienteRt,
  deleteClienteRt,
};
