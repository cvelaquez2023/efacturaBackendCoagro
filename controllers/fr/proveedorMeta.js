const { Op } = require("sequelize");
const { proveedorMetaModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. codigo: max 20, nombre: max 100 caracteres."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe un proveedor con ese codigo."];
  }
  if (error.name === "SequelizeForeignKeyConstraintError" || (error.parent && error.parent.number === 547)) {
    return ["El proveedor esta en uso en metas de venta, no se puede eliminar. Puede desactivarlo."];
  }
  return [fallback];
};

const toBool = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  return ["1", "S", "SI", "TRUE", "Y"].includes(String(v).trim().toUpperCase());
};

// Email del usuario web logueado (middleware/session deja el usuario en req.cliente).
const usuarioActual = (req) =>
  ((req.cliente && req.cliente[0] && req.cliente[0].email) || "").slice(0, 50) || undefined;

const getProveedoresMeta = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const { q } = req.query;
    const activo = toBool(req.query.activo);

    const where = {};
    if (activo !== undefined) where.activo = activo;
    if (q) {
      where[Op.or] = [
        { codigo: { [Op.like]: `%${q}%` } },
        { nombre: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await proveedorMetaModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["codigo", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar los proveedores") });
  }
};

const getProveedorMeta = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await proveedorMetaModel.findByPk(id, { raw: true });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["El proveedor no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar el proveedor") });
  }
};

const postProveedorMeta = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    const activo = toBool(req.body.activo);

    if (!codigo || !nombre) {
      return res.send({ result: {}, success: false, errors: ["codigo y nombre son obligatorios"] });
    }

    const existe = await proveedorMetaModel.findOne({ where: { codigo }, raw: true });
    if (existe) {
      return res.send({ result: {}, success: false, errors: ["Ya existe un proveedor con ese codigo."] });
    }

    // FechaCreacion la pone la BD (default getdate()).
    const data = await proveedorMetaModel.create({
      codigo,
      nombre,
      activo: activo === undefined ? true : activo,
      UsuarioCreacion: usuarioActual(req),
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear el proveedor") });
  }
};

const putProveedorMeta = async (req, res) => {
  const { id } = req.params;
  try {
    const { codigo, nombre } = req.body;
    const activo = toBool(req.body.activo);

    const actual = await proveedorMetaModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["El proveedor no existe"] });
    }

    if (codigo && codigo !== actual.codigo) {
      const existe = await proveedorMetaModel.findOne({
        where: { codigo, id: { [Op.ne]: id } },
        raw: true,
      });
      if (existe) {
        return res.send({ result: {}, success: false, errors: ["Ya existe un proveedor con ese codigo."] });
      }
    }

    const data = await proveedorMetaModel.update(
      { codigo, nombre, activo },
      { where: { id } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar el proveedor") });
  }
};

const deleteProveedorMeta = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await proveedorMetaModel.destroy({ where: { id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["El proveedor no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar el proveedor") });
  }
};

module.exports = {
  getProveedoresMeta,
  getProveedorMeta,
  postProveedorMeta,
  putProveedorMeta,
  deleteProveedorMeta,
};
