const { Op } = require("sequelize");
const { lineaNegocioModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  // 8152 = valor mas largo que la columna
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. codigo: max 4, nombre: max 100 caracteres."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una linea de negocio con ese codigo."];
  }
  // 547 = conflicto de FK (la linea esta usada en MetaVentaProducto)
  if (error.name === "SequelizeForeignKeyConstraintError" || (error.parent && error.parent.number === 547)) {
    return ["La linea de negocio esta en uso en metas de venta, no se puede eliminar. Puede desactivarla."];
  }
  return [fallback];
};

// Acepta true/false, 1/0, "S"/"N", "true"/"false". Devuelve undefined si no viene.
const toBool = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  return ["1", "S", "SI", "TRUE", "Y"].includes(String(v).trim().toUpperCase());
};

const getLineasNegocio = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const { q } = req.query;
    const activa = toBool(req.query.activa);

    const where = {};
    if (activa !== undefined) where.activa = activa;
    if (q) {
      where[Op.or] = [
        { codigo: { [Op.like]: `%${q}%` } },
        { nombre: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await lineaNegocioModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["codigo", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar las lineas de negocio") });
  }
};

const getLineaNegocio = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await lineaNegocioModel.findByPk(id, { raw: true });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La linea de negocio no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar la linea de negocio") });
  }
};

const postLineaNegocio = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    const activa = toBool(req.body.activa);

    if (!codigo || !nombre) {
      return res.send({ result: {}, success: false, errors: ["codigo y nombre son obligatorios"] });
    }

    const existe = await lineaNegocioModel.findOne({ where: { codigo }, raw: true });
    if (existe) {
      return res.send({ result: {}, success: false, errors: ["Ya existe una linea de negocio con ese codigo."] });
    }

    const data = await lineaNegocioModel.create({
      codigo,
      nombre,
      activa: activa === undefined ? true : activa,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear la linea de negocio") });
  }
};

const putLineaNegocio = async (req, res) => {
  const { id } = req.params;
  try {
    const { codigo, nombre } = req.body;
    const activa = toBool(req.body.activa);

    const actual = await lineaNegocioModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["La linea de negocio no existe"] });
    }

    if (codigo && codigo !== actual.codigo) {
      const existe = await lineaNegocioModel.findOne({
        where: { codigo, id: { [Op.ne]: id } },
        raw: true,
      });
      if (existe) {
        return res.send({ result: {}, success: false, errors: ["Ya existe una linea de negocio con ese codigo."] });
      }
    }

    const data = await lineaNegocioModel.update(
      { codigo, nombre, activa },
      { where: { id } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar la linea de negocio") });
  }
};

const deleteLineaNegocio = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await lineaNegocioModel.destroy({ where: { id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La linea de negocio no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar la linea de negocio") });
  }
};

module.exports = {
  getLineasNegocio,
  getLineaNegocio,
  postLineaNegocio,
  putLineaNegocio,
  deleteLineaNegocio,
};
