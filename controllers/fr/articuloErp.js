const { Op } = require("sequelize");
const { articuloErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const CAMPOS = [
  "ARTICULO",
  "DESCRIPCION",
  "CLASIFICACION_1",
  "CLASIFICACION_2",
  "CLASIFICACION_3",
  "CLASIFICACION_4",
  "CLASIFICACION_5",
  "CLASIFICACION_6",
  "TIPO",
  "UNIDAD_ALMACEN",
  "UNIDAD_EMPAQUE",
  "UNIDAD_VENTA",
  "CODIGO_BARRAS_VENT",
  "GTIN",
  "PESO_NETO",
  "PESO_BRUTO",
  "VOLUMEN",
  "PRECIO_BASE_LOCAL",
  "PRECIO_BASE_DOLAR",
  "PROVEEDOR",
];

// GET /fr/articuloErp?q=texto&clasificacion1=XX&tipo=T&proveedor=P&page=1&limit=20
// Busca articulos que ya existen en el ERP para darlos de alta en el modulo de rutas.
const getArticulosErp = async (req, res) => {
  try {
    const { q, clasificacion1, tipo, proveedor } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (clasificacion1) where.CLASIFICACION_1 = clasificacion1;
    if (tipo) where.TIPO = tipo;
    if (proveedor) where.PROVEEDOR = proveedor;
    if (q) {
      where[Op.or] = [
        { ARTICULO: { [Op.like]: `%${q}%` } },
        { DESCRIPCION: { [Op.like]: `%${q}%` } },
        { CODIGO_BARRAS_VENT: { [Op.like]: `%${q}%` } },
        { GTIN: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await articuloErpModel.findAndCountAll({
      attributes: CAMPOS,
      where,
      limit,
      offset,
      order: [["DESCRIPCION", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar los articulos del ERP"],
    });
  }
};

// GET /fr/articuloErp/:articulo
const getArticuloErp = async (req, res) => {
  const { articulo } = req.params;
  try {
    const data = await articuloErpModel.findOne({
      attributes: CAMPOS,
      where: { ARTICULO: articulo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el articulo del ERP"],
    });
  }
};

module.exports = {
  getArticulosErp,
  getArticuloErp,
};
