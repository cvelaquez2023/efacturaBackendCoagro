const { Op } = require("sequelize");
const { clienteErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const CAMPOS = [
  "CLIENTE",
  "NOMBRE",
  "ALIAS",
  "CONTACTO",
  "DIRECCION",
  "TELEFONO1",
  "TELEFONO2",
  "FAX",
  "E_MAIL",
  "PAIS",
  "ZONA",
  "RUTA",
  "VENDEDOR",
  "COBRADOR",
  "ACTIVO",
  "GEO_LATITUD",
  "GEO_LONGITUD",
];

// GET /fr/clienteErp?q=texto&ruta=R01&activo=S&page=1&limit=20
// Busca clientes que ya existen en el ERP para asociarlos al modulo de rutas.
// Devuelve los resultados paginados (20 por pagina por defecto).
const getClientesErp = async (req, res) => {
  try {
    const { q, ruta, vendedor, activo } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (ruta) where.RUTA = ruta;
    if (vendedor) where.VENDEDOR = vendedor;
    if (activo) where.ACTIVO = activo;
    if (q) {
      where[Op.or] = [
        { CLIENTE: { [Op.like]: `%${q}%` } },
        { NOMBRE: { [Op.like]: `%${q}%` } },
        { ALIAS: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await clienteErpModel.findAndCountAll({
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
      errors: ["Error al consultar los clientes del ERP"],
    });
  }
};

// GET /fr/clienteErp/:cliente
const getClienteErp = async (req, res) => {
  const { cliente } = req.params;
  try {
    const data = await clienteErpModel.findOne({
      attributes: CAMPOS,
      where: { CLIENTE: cliente },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el cliente del ERP"],
    });
  }
};

module.exports = {
  getClientesErp,
  getClienteErp,
};
