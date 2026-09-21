const {
  clienteAsocRtModel,
  clienteRtModel,
  bodegaAsocRtModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: CLIENTE 20, CODIGO 20, BODEGA_CONSIGNA 4, LOCALIZACION_CONSIGNA 8.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una asociacion con ese codigo."];
  }
  return [fallback];
};

// GET /fr/clienteAsocRt?cliente=X&page=1&limit=20
const getClientesAsocRt = async (req, res) => {
  try {
    const { cliente } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (cliente) where.CLIENTE = cliente;

    const data = await clienteAsocRtModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["CLIENTE", "ASC"],
        ["CODIGO", "ASC"],
      ],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar las asociaciones de cliente"),
    });
  }
};

// GET /fr/clienteAsocRt/:codigo
const getClienteAsocRt = async (req, res) => {
  const { codigo } = req.params;
  try {
    const data = await clienteAsocRtModel.findOne({
      where: { CODIGO: codigo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la asociacion de cliente"),
    });
  }
};

// POST /fr/clienteAsocRt
// { cliente, codigo, bodegaConsigna, localizacionConsigna }
// Asocia un cliente que YA existe en CLIENTE_RT con un codigo propio del
// sistema de ruteo. Relacion 1:1: ni el cliente ni el codigo pueden
// repetirse. bodegaConsigna (si se manda) debe existir en BODEGA_ASOC_RT:
// solo se pueden usar bodegas ya asociadas a un codigo de ruteo, no
// cualquier bodega de BODEGA_RT.
const postClienteAsocRt = async (req, res) => {
  try {
    const { cliente, codigo, bodegaConsigna, localizacionConsigna } = req.body;

    if (!cliente || !codigo) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos cliente y codigo son obligatorios"],
      });
    }

    const clienteRt = await clienteRtModel.findOne({
      where: { CLIENTE: cliente },
      raw: true,
    });
    if (!clienteRt) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El cliente ${cliente} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/clienteRt.`,
        ],
      });
    }

    if (bodegaConsigna) {
      const bodegaAsociada = await bodegaAsocRtModel.findOne({
        where: { CODIGO: bodegaConsigna },
        raw: true,
      });
      if (!bodegaAsociada) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El codigo de bodega ${bodegaConsigna} no existe en BODEGA_ASOC_RT. Asocia la bodega primero con POST /fr/bodegaAsocRt (o consulta GET /fr/bodegaAsocRt para ver los codigos disponibles).`,
          ],
        });
      }
    }

    const clienteYaAsociado = await clienteAsocRtModel.findOne({
      where: { CLIENTE: cliente },
      raw: true,
    });
    if (clienteYaAsociado) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El cliente ${cliente} ya tiene un codigo asociado (${clienteYaAsociado.CODIGO}).`,
        ],
      });
    }

    const codigoYaUsado = await clienteAsocRtModel.findOne({
      where: { CODIGO: codigo },
      raw: true,
    });
    if (codigoYaUsado) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El codigo ${codigo} ya esta asociado a otro cliente (${codigoYaUsado.CLIENTE}).`,
        ],
      });
    }

    const data = await clienteAsocRtModel.create({
      CODIGO: codigo,
      CLIENTE: cliente,
      COMPANIA: null, // el sistema no maneja companias
      BODEGA_CONSIGNA: bodegaConsigna || null,
      LOCALIZACION_CONSIGNA: localizacionConsigna || null,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la asociacion de cliente"),
    });
  }
};

// PUT /fr/clienteAsocRt/:codigo
// { cliente, bodegaConsigna, localizacionConsigna }
// El CODIGO (PK) no se edita aqui; para cambiar el codigo de un cliente hay
// que eliminar la asociacion y crear una nueva. bodegaConsigna (si se manda)
// debe existir en BODEGA_ASOC_RT (ver postClienteAsocRt).
const putClienteAsocRt = async (req, res) => {
  const { codigo } = req.params;
  try {
    const { cliente, bodegaConsigna, localizacionConsigna } = req.body;

    const actual = await clienteAsocRtModel.findOne({
      where: { CODIGO: codigo },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`El codigo ${codigo} no tiene una asociacion en el modulo de rutas.`],
      });
    }

    if (cliente) {
      const clienteRt = await clienteRtModel.findOne({
        where: { CLIENTE: cliente },
        raw: true,
      });
      if (!clienteRt) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El cliente ${cliente} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/clienteRt.`,
          ],
        });
      }

      const clienteYaAsociado = await clienteAsocRtModel.findOne({
        where: { CLIENTE: cliente },
        raw: true,
      });
      if (clienteYaAsociado && clienteYaAsociado.CODIGO !== codigo) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El cliente ${cliente} ya tiene un codigo asociado (${clienteYaAsociado.CODIGO}).`,
          ],
        });
      }
    }

    if (bodegaConsigna) {
      const bodegaAsociada = await bodegaAsocRtModel.findOne({
        where: { CODIGO: bodegaConsigna },
        raw: true,
      });
      if (!bodegaAsociada) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El codigo de bodega ${bodegaConsigna} no existe en BODEGA_ASOC_RT. Asocia la bodega primero con POST /fr/bodegaAsocRt (o consulta GET /fr/bodegaAsocRt para ver los codigos disponibles).`,
          ],
        });
      }
    }

    const cambios = {};
    if (cliente !== undefined) cambios.CLIENTE = cliente;
    if (bodegaConsigna !== undefined) cambios.BODEGA_CONSIGNA = bodegaConsigna;
    if (localizacionConsigna !== undefined)
      cambios.LOCALIZACION_CONSIGNA = localizacionConsigna;

    const data = await clienteAsocRtModel.update(cambios, {
      where: { CODIGO: codigo },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la asociacion de cliente"),
    });
  }
};

// DELETE /fr/clienteAsocRt/:codigo
const deleteClienteAsocRt = async (req, res) => {
  const { codigo } = req.params;
  try {
    const data = await clienteAsocRtModel.destroy({
      where: { CODIGO: codigo },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asociacion de cliente"),
    });
  }
};

module.exports = {
  getClientesAsocRt,
  getClienteAsocRt,
  postClienteAsocRt,
  putClienteAsocRt,
  deleteClienteAsocRt,
};
