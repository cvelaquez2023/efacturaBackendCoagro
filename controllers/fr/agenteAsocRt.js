const { agenteAsocRtModel, agenteRtModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: AGENTE 4, CODIGO 4, TIPO 1.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una asociacion con ese agente y ese codigo."];
  }
  return [fallback];
};

// GET /fr/agenteAsocRt?page=1&limit=20
const getAgentesAsocRt = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const data = await agenteAsocRtModel.findAndCountAll({
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
      errors: parseErrores(error, "Error al consultar las asociaciones de agente"),
    });
  }
};

// GET /fr/agenteAsocRt/:agente
const getAgenteAsocRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const data = await agenteAsocRtModel.findOne({
      where: { AGENTE: agente },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la asociacion de agente"),
    });
  }
};

// POST /fr/agenteAsocRt
// { agente, codigo, tipo }
// Asocia un agente que YA existe en AGENTE_RT con un codigo propio del
// sistema de ruteo. Relacion 1:1: ni el agente ni el codigo pueden repetirse.
const postAgenteAsocRt = async (req, res) => {
  try {
    const { agente, codigo, tipo } = req.body;

    if (!agente || !codigo || !tipo) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos agente, codigo y tipo son obligatorios"],
      });
    }

    const agenteRt = await agenteRtModel.findOne({
      where: { AGENTE: agente },
      raw: true,
    });
    if (!agenteRt) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El agente ${agente} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/agenteRt.`,
        ],
      });
    }

    const agenteYaAsociado = await agenteAsocRtModel.findOne({
      where: { AGENTE: agente },
      raw: true,
    });
    if (agenteYaAsociado) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El agente ${agente} ya tiene un codigo asociado (${agenteYaAsociado.CODIGO}).`,
        ],
      });
    }

    const codigoYaUsado = await agenteAsocRtModel.findOne({
      where: { CODIGO: codigo },
      raw: true,
    });
    if (codigoYaUsado) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El codigo ${codigo} ya esta asociado a otro agente (${codigoYaUsado.AGENTE}).`,
        ],
      });
    }

    const data = await agenteAsocRtModel.create({
      AGENTE: agente,
      CODIGO: codigo,
      COMPANIA: null, // el sistema no maneja companias
      TIPO: tipo,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la asociacion de agente"),
    });
  }
};

// PUT /fr/agenteAsocRt/:agente
// { codigo, tipo }
const putAgenteAsocRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const { codigo, tipo } = req.body;

    const actual = await agenteAsocRtModel.findOne({
      where: { AGENTE: agente },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`El agente ${agente} no tiene una asociacion en el modulo de rutas.`],
      });
    }

    if (codigo) {
      const codigoYaUsado = await agenteAsocRtModel.findOne({
        where: { CODIGO: codigo },
        raw: true,
      });
      if (codigoYaUsado && codigoYaUsado.AGENTE !== agente) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El codigo ${codigo} ya esta asociado a otro agente (${codigoYaUsado.AGENTE}).`,
          ],
        });
      }
    }

    const cambios = {};
    if (codigo !== undefined) cambios.CODIGO = codigo;
    if (tipo !== undefined) cambios.TIPO = tipo;

    const data = await agenteAsocRtModel.update(cambios, {
      where: { AGENTE: agente },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la asociacion de agente"),
    });
  }
};

// DELETE /fr/agenteAsocRt/:agente
const deleteAgenteAsocRt = async (req, res) => {
  const { agente } = req.params;
  try {
    const data = await agenteAsocRtModel.destroy({
      where: { AGENTE: agente },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asociacion de agente"),
    });
  }
};

module.exports = {
  getAgentesAsocRt,
  getAgenteAsocRt,
  postAgenteAsocRt,
  putAgenteAsocRt,
  deleteAgenteAsocRt,
};
