const { Op } = require("sequelize");
const { liderModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. codigo: max 4, nombre y email: max 100 caracteres."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    // El UNIQUE de email en SQL Server solo permite UN registro con email NULL.
    return ["Ya existe un lider con ese codigo o ese email (solo un lider puede quedar sin email)."];
  }
  if (error.name === "SequelizeForeignKeyConstraintError" || (error.parent && error.parent.number === 547)) {
    return ["El lider esta en uso en metas de venta, no se puede eliminar. Puede desactivarlo."];
  }
  return [fallback];
};

const toBool = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  return ["1", "S", "SI", "TRUE", "Y"].includes(String(v).trim().toUpperCase());
};

const getLideres = async (req, res) => {
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
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const data = await liderModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [["codigo", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar los lideres") });
  }
};

const getLider = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await liderModel.findByPk(id, { raw: true });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["El lider no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar el lider") });
  }
};

// Valida que codigo/email no esten usados por otro lider (idExcluir en el PUT).
const validarDuplicados = async ({ codigo, email }, idExcluir) => {
  const errores = [];
  const excluir = idExcluir ? { id: { [Op.ne]: idExcluir } } : {};
  if (codigo) {
    const dup = await liderModel.findOne({ where: { codigo, ...excluir }, raw: true });
    if (dup) errores.push("Ya existe un lider con ese codigo.");
  }
  if (email) {
    const dup = await liderModel.findOne({ where: { email, ...excluir }, raw: true });
    if (dup) errores.push("Ya existe un lider con ese email.");
  }
  return errores;
};

const postLider = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    const email = req.body.email ? String(req.body.email).trim() : undefined;
    const activo = toBool(req.body.activo);

    if (!codigo || !nombre) {
      return res.send({ result: {}, success: false, errors: ["codigo y nombre son obligatorios"] });
    }

    const errores = await validarDuplicados({ codigo, email });
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    const data = await liderModel.create({
      codigo,
      nombre,
      email,
      activo: activo === undefined ? true : activo,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear el lider") });
  }
};

const putLider = async (req, res) => {
  const { id } = req.params;
  try {
    const { codigo, nombre } = req.body;
    const email = req.body.email ? String(req.body.email).trim() : undefined;
    const activo = toBool(req.body.activo);

    const actual = await liderModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["El lider no existe"] });
    }

    const errores = await validarDuplicados({ codigo, email }, id);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    const data = await liderModel.update(
      { codigo, nombre, email, activo },
      { where: { id } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar el lider") });
  }
};

const deleteLider = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await liderModel.destroy({ where: { id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["El lider no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar el lider") });
  }
};

module.exports = {
  getLideres,
  getLider,
  postLider,
  putLider,
  deleteLider,
};
