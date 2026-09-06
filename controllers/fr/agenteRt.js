const { agenteRtModel, vendedorErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido en la base de datos."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un agente con ese codigo."];
  }
  return [fallback];
};

const getAgentesRt = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const data = await agenteRtModel.findAndCountAll({
      limit,
      offset,
      order: [["AGENTE", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar los agentes"),
    });
  }
};

const getAgenteRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const data = await agenteRtModel.findOne({
      where: { AGENTE: agente },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar el agente"),
    });
  }
};

// POST /fr/agenteRt
// Toma un vendedor que YA existe y esta ACTIVO en el ERP (schema CINCOH,
// seleccionado del GET /fr/vendedorErp) y lo da de alta como agente.
const postAgenteRt = async (req, res) => {
  try {
    const { vendedor } = req.body;

    if (!vendedor) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo vendedor es obligatorio"],
      });
    }

    const vendedorErp = await vendedorErpModel.findOne({
      attributes: ["VENDEDOR", "NOMBRE", "ACTIVO"],
      where: { VENDEDOR: vendedor },
      raw: true,
    });

    if (!vendedorErp) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El vendedor ${vendedor} no existe en el ERP. Creelo primero con el CRUD de vendedores.`,
        ],
      });
    }

    if (vendedorErp.ACTIVO !== "S") {
      return res.send({
        result: {},
        success: false,
        errors: [`El vendedor ${vendedor} no esta activo en el ERP.`],
      });
    }

    const yaExiste = await agenteRtModel.findOne({
      where: { AGENTE: vendedor },
      raw: true,
    });
    if (yaExiste) {
      return res.send({
        result: {},
        success: false,
        errors: [`El vendedor ${vendedor} ya esta registrado como agente.`],
      });
    }

    const data = await agenteRtModel.create({
      AGENTE: vendedorErp.VENDEDOR,
      NOMBRE: vendedorErp.NOMBRE,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear el agente"),
    });
  }
};

const putAgenteRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const { nombre } = req.body;

    const data = await agenteRtModel.update(
      { NOMBRE: nombre },
      { where: { AGENTE: agente } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar el agente"),
    });
  }
};

const deleteAgenteRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const data = await agenteRtModel.destroy({
      where: { AGENTE: agente },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar el agente"),
    });
  }
};

module.exports = {
  getAgentesRt,
  getAgenteRt,
  postAgenteRt,
  putAgenteRt,
  deleteAgenteRt,
};
