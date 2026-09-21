const { rutaClienteModel, rutaRtModel, clienteAsocRtModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. Largos: RUTA 4, CLIENTE 20."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ese cliente ya esta asignado a esa ruta en ese dia."];
  }
  return [fallback];
};

const diaValido = (dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7;

// Valida que ruta y cliente existan en sus tablas correspondientes.
// Devuelve un mensaje de error o null si todo existe.
const validarReferencias = async ({ ruta, cliente }) => {
  if (ruta !== undefined) {
    const rutaRt = await rutaRtModel.findOne({ where: { RUTA: ruta }, raw: true });
    if (!rutaRt) {
      return `La ruta ${ruta} no existe en el modulo de rutas. Dala de alta primero con POST /fr/rutaRt.`;
    }
  }

  if (cliente !== undefined) {
    const clienteAsoc = await clienteAsocRtModel.findOne({
      where: { CODIGO: cliente },
      raw: true,
    });
    if (!clienteAsoc) {
      return `El cliente ${cliente} no existe en el modulo de rutas. Dalo de alta primero con POST /fr/clienteAsocRt.`;
    }
  }

  return null;
};

// GET /fr/rutaCliente?ruta=&cliente=&dia=&page=1&limit=20
const getRutasCliente = async (req, res) => {
  try {
    const { ruta, cliente, dia } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (ruta) where.RUTA = ruta;
    if (cliente) where.CLIENTE = cliente;
    if (dia) where.DIA = parseInt(dia, 10);

    const data = await rutaClienteModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["RUTA", "ASC"],
        ["DIA", "ASC"],
        ["ORDEN", "ASC"],
      ],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar las asignaciones de ruta-cliente"),
    });
  }
};

// GET /fr/rutaCliente/:ruta/:cliente/:dia
const getRutaCliente = async (req, res) => {
  const { ruta, cliente, dia } = req.params;
  try {
    const data = await rutaClienteModel.findOne({
      where: { RUTA: ruta, CLIENTE: cliente, DIA: parseInt(dia, 10) },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la asignacion de ruta-cliente"),
    });
  }
};

// POST /fr/rutaCliente
// { ruta, cliente, dia, orden }
// ruta debe existir en RUTA_RT; cliente es el CODIGO de CLIENTE_ASOC_RT
// (regla de oro del modulo). dia es el dia de la semana (1=Lunes..7=Domingo).
// Un cliente solo puede tener un dia asignado por ruta (no se repite en
// mas de un dia dentro de la misma ruta).
const postRutaCliente = async (req, res) => {
  try {
    const { ruta, cliente, orden } = req.body;
    const dia = parseInt(req.body.dia, 10);

    if (!ruta || !cliente || req.body.dia === undefined || orden === undefined) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos ruta, cliente, dia y orden son obligatorios"],
      });
    }

    if (!diaValido(dia)) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo dia debe ser un numero entero entre 1 (Lunes) y 7 (Domingo)"],
      });
    }

    const errorReferencias = await validarReferencias({ ruta, cliente });
    if (errorReferencias) {
      return res.send({ result: {}, success: false, errors: [errorReferencias] });
    }

    const yaAsignadoEnRuta = await rutaClienteModel.findOne({
      where: { RUTA: ruta, CLIENTE: cliente },
      raw: true,
    });
    if (yaAsignadoEnRuta) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El cliente ${cliente} ya esta asignado a la ruta ${ruta} en el dia ${yaAsignadoEnRuta.DIA}. Un cliente solo puede tener un dia por ruta.`,
        ],
      });
    }

    const data = await rutaClienteModel.create({
      RUTA: ruta,
      CLIENTE: cliente,
      DIA: dia,
      ORDEN: orden,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la asignacion de ruta-cliente"),
    });
  }
};

// PUT /fr/rutaCliente/:ruta/:cliente/:dia
// { orden } -- ruta, cliente y dia son la PK (identidad de la fila); para
// reasignarlos hay que borrar y crear de nuevo.
const putRutaCliente = async (req, res) => {
  const { ruta, cliente, dia } = req.params;
  try {
    const { orden } = req.body;

    if (orden === undefined) {
      return res.send({
        result: {},
        success: false,
        errors: ["El campo orden es obligatorio"],
      });
    }

    const actual = await rutaClienteModel.findOne({
      where: { RUTA: ruta, CLIENTE: cliente, DIA: parseInt(dia, 10) },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El cliente ${cliente} no tiene una asignacion en la ruta ${ruta} para el dia ${dia}.`,
        ],
      });
    }

    const data = await rutaClienteModel.update(
      { ORDEN: orden },
      { where: { RUTA: ruta, CLIENTE: cliente, DIA: parseInt(dia, 10) } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la asignacion de ruta-cliente"),
    });
  }
};

// DELETE /fr/rutaCliente/:ruta/:cliente/:dia
const deleteRutaCliente = async (req, res) => {
  const { ruta, cliente, dia } = req.params;
  try {
    const data = await rutaClienteModel.destroy({
      where: { RUTA: ruta, CLIENTE: cliente, DIA: parseInt(dia, 10) },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asignacion de ruta-cliente"),
    });
  }
};

module.exports = {
  getRutasCliente,
  getRutaCliente,
  postRutaCliente,
  putRutaCliente,
  deleteRutaCliente,
};
