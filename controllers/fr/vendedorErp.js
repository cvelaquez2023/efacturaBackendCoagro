const { Op } = require("sequelize");
const { vendedorErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const CAMPOS = [
  "VENDEDOR",
  "NOMBRE",
  "EMPLEADO",
  "COMISION",
  "E_MAIL",
  "Correo",
  "telefono",
  "ACTIVO",
];

// GET /fr/vendedorErp?q=texto&page=1&limit=20
// Busca vendedores que ya existen en el ERP para darlos de alta como agentes.
// Solo devuelve vendedores ACTIVOS.
const getVendedoresErp = async (req, res) => {
  try {
    const { q } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = { ACTIVO: "S" };
    if (q) {
      where[Op.or] = [
        { VENDEDOR: { [Op.like]: `%${q}%` } },
        { NOMBRE: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await vendedorErpModel.findAndCountAll({
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
      errors: ["Error al consultar los vendedores del ERP"],
    });
  }
};

// GET /fr/vendedorErp/:vendedor
const getVendedorErp = async (req, res) => {
  const { vendedor } = req.params;
  try {
    const data = await vendedorErpModel.findOne({
      attributes: CAMPOS,
      where: { VENDEDOR: vendedor },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el vendedor del ERP"],
    });
  }
};

module.exports = {
  getVendedoresErp,
  getVendedorErp,
};
