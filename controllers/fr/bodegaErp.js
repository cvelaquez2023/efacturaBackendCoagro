const { Op } = require("sequelize");
const { bodegaErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const CAMPOS = [
  "BODEGA",
  "NOMBRE",
  "TIPO",
  "TELEFONO",
  "DIRECCION",
  "U_SUCURSAL",
  "U_COORDINADAS",
  "CODIGO_ESTABLECIMIENTO",
];

// GET /fr/bodegaErp?q=texto&tipo=T&page=1&limit=20
// Busca bodegas que ya existen en el ERP para darlas de alta en el modulo de rutas.
const getBodegasErp = async (req, res) => {
  try {
    const { q, tipo } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (tipo) where.TIPO = tipo;
    if (q) {
      where[Op.or] = [
        { BODEGA: { [Op.like]: `%${q}%` } },
        { NOMBRE: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await bodegaErpModel.findAndCountAll({
      attributes: CAMPOS,
      where,
      limit,
      offset,
      order: [["NOMBRE", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar las bodegas del ERP"],
    });
  }
};

// GET /fr/bodegaErp/:bodega
const getBodegaErp = async (req, res) => {
  const { bodega } = req.params;
  try {
    const data = await bodegaErpModel.findOne({
      attributes: CAMPOS,
      where: { BODEGA: bodega },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar la bodega del ERP"],
    });
  }
};

module.exports = {
  getBodegasErp,
  getBodegaErp,
};
