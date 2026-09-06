const { clienteRtModel, clienteErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

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
    const { page, limit, offset } = getPaginacion(req.query);
    const data = await clienteRtModel.findAndCountAll({
      limit,
      offset,
      order: [["CLIENTE", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
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

// POST /fr/clienteRt
// Toma un cliente que YA existe y esta ACTIVO en el ERP (schema CINCOH,
// seleccionado del GET /fr/clienteErp) y lo da de alta en el modulo de rutas.
const postClienteRt = async (req, res) => {
  try {
    const {
      cliente,
      latitud,
      longitud,
      altitud,
      fechaActualizacionUbicacion,
    } = req.body;

    if (!cliente) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo cliente es obligatorio"],
      });
    }

    const clienteErp = await clienteErpModel.findOne({
      attributes: ["CLIENTE", "NOMBRE", "ACTIVO", "GEO_LATITUD", "GEO_LONGITUD"],
      where: { CLIENTE: cliente },
      raw: true,
    });

    if (!clienteErp) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El cliente ${cliente} no existe en el ERP. Creelo primero con el CRUD de clientes.`,
        ],
      });
    }

    if (clienteErp.ACTIVO !== "S") {
      return res.send({
        result: {},
        success: false,
        errors: [`El cliente ${cliente} no esta activo en el ERP.`],
      });
    }

    const yaExiste = await clienteRtModel.findOne({
      where: { CLIENTE: cliente },
      raw: true,
    });
    if (yaExiste) {
      return res.send({
        result: {},
        success: false,
        errors: [`El cliente ${cliente} ya esta registrado en el modulo de rutas.`],
      });
    }

    const data = await clienteRtModel.create({
      CLIENTE: clienteErp.CLIENTE,
      NOMBRE: clienteErp.NOMBRE,
      LATITUD: latitud != null ? latitud : clienteErp.GEO_LATITUD,
      LONGITUD: longitud != null ? longitud : clienteErp.GEO_LONGITUD,
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
