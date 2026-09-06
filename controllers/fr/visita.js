const { visitaModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const getVisitas = async (req, res) => {
  try {
    const { ruta, cliente } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);
    const where = {};
    if (ruta) where.RUTA = ruta;
    if (cliente) where.CLIENTE = cliente;

    const data = await visitaModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["INICIO", "DESC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar las visitas"],
    });
  }
};

const getVisita = async (req, res) => {
  const { ruta, cliente, inicio } = req.params;
  try {
    const data = await visitaModel.findOne({
      where: { RUTA: ruta, CLIENTE: cliente, INICIO: inicio },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar la visita"],
    });
  }
};

const postVisita = async (req, res) => {
  try {
    const { cliente, ruta, inicio, razon, fin, fechaPlan, tipo, notas, docPro } =
      req.body;

    const data = await visitaModel.create({
      CLIENTE: cliente,
      RUTA: ruta,
      INICIO: inicio,
      RAZON: razon,
      FIN: fin,
      FECHA_PLAN: fechaPlan,
      TIPO: tipo,
      NOTAS: notas,
      DOC_PRO: docPro,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al crear la visita"],
    });
  }
};

const putVisita = async (req, res) => {
  const { ruta, cliente, inicio } = req.params;
  try {
    const { razon, fin, fechaPlan, tipo, notas, docPro } = req.body;

    const data = await visitaModel.update(
      {
        RAZON: razon,
        FIN: fin,
        FECHA_PLAN: fechaPlan,
        TIPO: tipo,
        NOTAS: notas,
        DOC_PRO: docPro,
      },
      { where: { RUTA: ruta, CLIENTE: cliente, INICIO: inicio } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al actualizar la visita"],
    });
  }
};

const deleteVisita = async (req, res) => {
  const { ruta, cliente, inicio } = req.params;
  try {
    const data = await visitaModel.destroy({
      where: { RUTA: ruta, CLIENTE: cliente, INICIO: inicio },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al eliminar la visita"],
    });
  }
};

module.exports = {
  getVisitas,
  getVisita,
  postVisita,
  putVisita,
  deleteVisita,
};
