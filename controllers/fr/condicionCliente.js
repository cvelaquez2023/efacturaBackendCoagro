const { Op } = require("sequelize");
const { frCondicionClienteModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");
const { vacio, toSN, usuarioActual, validarAlcanceValor } = require("../../utils/alcanceFr");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. CLIENTE: max 20, VALOR: max 60 caracteres."];
  }
  // 547 = CHECK de la BD (fechas, rangos, ALCANCE...)
  if (error.parent && error.parent.number === 547) {
    return ["Los datos no cumplen las reglas de la tabla (revisa fechas, descuento 0-100, precio y cantidad mayores que 0)."];
  }
  return [fallback];
};

// Toma del body solo los campos que vienen (camelCase -> columnas de BD).
// En PUT, un campo enviado como null se limpia (por eso se distingue undefined de null).
const leerBody = (body) => {
  const mapa = {
    cliente: "CLIENTE",
    alcance: "ALCANCE",
    valor: "VALOR",
    descuentoMax: "DESCUENTO_MAX",
    precioEspecial: "PRECIO_ESPECIAL",
    cantidadMin: "CANTIDAD_MIN",
    fechaInicio: "FECHA_INICIO",
    fechaFin: "FECHA_FIN",
  };
  const campos = {};
  for (const [js, db] of Object.entries(mapa)) {
    if (body[js] === undefined) continue;
    let v = body[js] === "" ? null : body[js];
    if (typeof v === "string") v = v.trim();
    if (["ALCANCE"].includes(db) && v) v = v.toUpperCase();
    campos[db] = v;
  }
  const activa = toSN(body.activa);
  if (activa) campos.ACTIVA = activa;
  return campos;
};

// Reglas de negocio sobre el registro final (en PUT ya mezclado con el actual).
const validarCondicion = async (c, cambios) => {
  const errores = [];
  for (const k of ["CLIENTE", "ALCANCE", "VALOR", "FECHA_INICIO"]) {
    if (vacio(c[k])) errores.push(`${k} es obligatorio`);
  }
  if (vacio(c.DESCUENTO_MAX) && vacio(c.PRECIO_ESPECIAL)) {
    errores.push("Debe indicar DESCUENTO_MAX o PRECIO_ESPECIAL");
  }
  if (!vacio(c.FECHA_FIN) && !vacio(c.FECHA_INICIO) && String(c.FECHA_FIN) < String(c.FECHA_INICIO)) {
    errores.push("FECHA_FIN no puede ser menor que FECHA_INICIO");
  }
  if (errores.length) return errores;

  if (cambios.ALCANCE !== undefined || cambios.VALOR !== undefined) {
    const e = await validarAlcanceValor(c.ALCANCE, c.VALOR);
    if (e) errores.push(e);
  }
  return errores;
};

// GET /fr/condicionCliente?cliente=&alcance=&activa=&vigente=YYYY-MM-DD&q=&page=&limit=
const getCondicionesCliente = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const { cliente, alcance, vigente, q } = req.query;
    const activa = toSN(req.query.activa);

    const where = {};
    if (!vacio(cliente)) where.CLIENTE = cliente;
    if (!vacio(alcance)) where.ALCANCE = String(alcance).toUpperCase();
    if (activa) where.ACTIVA = activa;
    if (!vacio(q)) {
      where[Op.or] = [{ CLIENTE: { [Op.like]: `%${q}%` } }, { VALOR: { [Op.like]: `%${q}%` } }];
    }
    if (!vacio(vigente)) {
      where.FECHA_INICIO = { [Op.lte]: vigente };
      where[Op.and] = [{ [Op.or]: [{ FECHA_FIN: null }, { FECHA_FIN: { [Op.gte]: vigente } }] }];
    }

    const data = await frCondicionClienteModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["CLIENTE", "ASC"],
        ["FECHA_INICIO", "DESC"],
      ],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar las condiciones de cliente") });
  }
};

const getCondicionCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await frCondicionClienteModel.findByPk(id, { raw: true });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La condicion no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar la condicion") });
  }
};

const postCondicionCliente = async (req, res) => {
  try {
    const campos = leerBody(req.body);
    const errores = await validarCondicion(campos, campos);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    // FECHA_CREACION la pone la BD (default getdate()).
    const data = await frCondicionClienteModel.create({
      ...campos,
      ACTIVA: campos.ACTIVA || "S",
      CREADO_POR: usuarioActual(req),
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear la condicion") });
  }
};

const putCondicionCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const actual = await frCondicionClienteModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["La condicion no existe"] });
    }

    const cambios = leerBody(req.body);
    if (!Object.keys(cambios).length) {
      return res.send({ result: {}, success: false, errors: ["No se enviaron campos para actualizar"] });
    }

    const errores = await validarCondicion({ ...actual, ...cambios }, cambios);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    // omitNull:false para poder limpiar campos opcionales (ej FECHA_FIN = null -> no vence).
    const data = await frCondicionClienteModel.update(
      { ...cambios, MODIFICADO_POR: usuarioActual(req), FECHA_MODIFICACION: new Date() },
      { where: { ID: id }, omitNull: false }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar la condicion") });
  }
};

const deleteCondicionCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await frCondicionClienteModel.destroy({ where: { ID: id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La condicion no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar la condicion") });
  }
};

module.exports = {
  getCondicionesCliente,
  getCondicionCliente,
  postCondicionCliente,
  putCondicionCliente,
  deleteCondicionCliente,
};
