const { Op } = require("sequelize");
const { consecutivoCiErpModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const CAMPOS = [
  "CONSECUTIVO",
  "DESCRIPCION",
  "MASCARA",
  "SIGUIENTE_CONSEC",
  "EDITABLE",
  "MULTIPLES_TRANS",
  "TODAS_TRANS",
  "TIPO",
  "USA_TRASLADO",
];

// GET /fr/consecutivoCiErp?q=texto&page=1&limit=20
// Lista los consecutivos de CINCOH.CONSECUTIVO_CI para elegir el que se
// asocia a una bodega en BODEGA_ASOC_RT.
const getConsecutivosCiErp = async (req, res) => {
  try {
    const { q } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const where = {};
    if (q) {
      where[Op.or] = [
        { CONSECUTIVO: { [Op.like]: `%${q}%` } },
        { DESCRIPCION: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await consecutivoCiErpModel.findAndCountAll({
      attributes: CAMPOS,
      where,
      limit,
      offset,
      order: [["CONSECUTIVO", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar los consecutivos del ERP"],
    });
  }
};

// GET /fr/consecutivoCiErp/:consecutivo
const getConsecutivoCiErp = async (req, res) => {
  const { consecutivo } = req.params;
  try {
    const data = await consecutivoCiErpModel.findOne({
      attributes: CAMPOS,
      where: { CONSECUTIVO: consecutivo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el consecutivo del ERP"],
    });
  }
};

module.exports = {
  getConsecutivosCiErp,
  getConsecutivoCiErp,
};
