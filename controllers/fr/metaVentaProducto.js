const { Op } = require("sequelize");
const {
  metaVentaProductoModel,
  lineaNegocioModel,
  liderModel,
  proveedorMetaModel,
  vendedorErpModel,
  articuloErpModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. Vendedor: max 4, Articulo: max 20 caracteres."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una meta para ese anio, mes, vendedor y articulo."];
  }
  if (error.name === "SequelizeForeignKeyConstraintError" || (error.parent && error.parent.number === 547)) {
    return ["Alguna referencia no existe (linea de negocio, lider, proveedor, vendedor o articulo)."];
  }
  return [fallback];
};

const usuarioActual = (req) =>
  ((req.cliente && req.cliente[0] && req.cliente[0].email) || "").slice(0, 50) || undefined;

const vacio = (v) => v === undefined || v === null || v === "";

// Nombres de los catalogos para mostrar en la web.
const INCLUDES = [
  { association: "lineaNegocio", attributes: ["codigo", "nombre"] },
  { association: "lider", attributes: ["codigo", "nombre"] },
  { association: "proveedor", attributes: ["codigo", "nombre"] },
  { association: "vendedor", attributes: ["NOMBRE"] },
  { association: "articulo", attributes: ["DESCRIPCION"] },
];

// Toma del body solo los campos que vienen (camelCase -> columnas de BD).
const leerBody = (body) => {
  const campos = {
    Anio: body.anio,
    Mes: body.mes,
    IdLineaNegocio: body.idLineaNegocio,
    IdLider: body.idLider,
    Vendedor: body.vendedor,
    Articulo: body.articulo,
    IdProveedor: body.idProveedor,
    Meta_Unidades: body.metaUnidades,
    Venta_Unidades: body.ventaUnidades,
    Venta_Valor: body.ventaValor,
  };
  Object.keys(campos).forEach((k) => vacio(campos[k]) && delete campos[k]);
  return campos;
};

/**
 * Valida referencias y duplicado sobre el registro "final" (en PUT ya
 * mezclado con el actual). Solo revisa las referencias que cambian.
 */
const validarMeta = async (meta, cambios, idExcluir) => {
  const errores = [];

  if (cambios.IdLineaNegocio !== undefined) {
    const linea = await lineaNegocioModel.findByPk(meta.IdLineaNegocio, { raw: true });
    if (!linea) errores.push("La linea de negocio no existe");
    else if (linea.activa === false) errores.push("La linea de negocio esta inactiva");
  }
  if (cambios.IdLider !== undefined) {
    const lider = await liderModel.findByPk(meta.IdLider, { raw: true });
    if (!lider) errores.push("El lider no existe");
    else if (lider.activo === false) errores.push("El lider esta inactivo");
  }
  if (cambios.IdProveedor !== undefined) {
    const prov = await proveedorMetaModel.findByPk(meta.IdProveedor, { raw: true });
    if (!prov) errores.push("El proveedor no existe");
    else if (prov.activo === false) errores.push("El proveedor esta inactivo");
  }
  if (cambios.Vendedor !== undefined) {
    const vend = await vendedorErpModel.findOne({ where: { VENDEDOR: meta.Vendedor }, raw: true });
    if (!vend) errores.push("El vendedor no existe en el ERP");
    else if (vend.ACTIVO !== "S") errores.push("El vendedor esta inactivo en el ERP");
  }
  if (cambios.Articulo !== undefined) {
    const art = await articuloErpModel.findOne({ where: { ARTICULO: meta.Articulo }, raw: true });
    if (!art) errores.push("El articulo no existe en el ERP");
  }

  // UNIQUE (Anio, Mes, Vendedor, Articulo)
  if (["Anio", "Mes", "Vendedor", "Articulo"].some((k) => cambios[k] !== undefined)) {
    const where = {
      Anio: meta.Anio,
      Mes: meta.Mes,
      Vendedor: meta.Vendedor,
      Articulo: meta.Articulo,
    };
    if (idExcluir) where.IdMeta = { [Op.ne]: idExcluir };
    const dup = await metaVentaProductoModel.findOne({ where, raw: true });
    if (dup) errores.push("Ya existe una meta para ese anio, mes, vendedor y articulo.");
  }

  return errores;
};

const getMetasVentaProducto = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const { anio, mes, idLineaNegocio, idLider, idProveedor, vendedor, articulo } = req.query;

    const where = {};
    if (!vacio(anio)) where.Anio = anio;
    if (!vacio(mes)) where.Mes = mes;
    if (!vacio(idLineaNegocio)) where.IdLineaNegocio = idLineaNegocio;
    if (!vacio(idLider)) where.IdLider = idLider;
    if (!vacio(idProveedor)) where.IdProveedor = idProveedor;
    if (!vacio(vendedor)) where.Vendedor = vendedor;
    if (!vacio(articulo)) where.Articulo = { [Op.like]: `%${articulo}%` };

    const data = await metaVentaProductoModel.findAndCountAll({
      where,
      include: INCLUDES,
      limit,
      offset,
      order: [
        ["Anio", "DESC"],
        ["Mes", "DESC"],
        ["Vendedor", "ASC"],
        ["Articulo", "ASC"],
      ],
      raw: true,
      nest: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar las metas de venta") });
  }
};

const getMetaVentaProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await metaVentaProductoModel.findByPk(id, {
      include: INCLUDES,
      raw: true,
      nest: true,
    });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La meta de venta no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar la meta de venta") });
  }
};

const postMetaVentaProducto = async (req, res) => {
  try {
    const campos = leerBody(req.body);

    const obligatorios = {
      Anio: "anio",
      Mes: "mes",
      IdLineaNegocio: "idLineaNegocio",
      IdLider: "idLider",
      Vendedor: "vendedor",
      Articulo: "articulo",
      IdProveedor: "idProveedor",
      Meta_Unidades: "metaUnidades",
    };
    const faltan = Object.keys(obligatorios).filter((k) => campos[k] === undefined);
    if (faltan.length) {
      return res.send({
        result: {},
        success: false,
        errors: [`Campos obligatorios: ${faltan.map((k) => obligatorios[k]).join(", ")}`],
      });
    }

    const errores = await validarMeta(campos, campos);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    // FechaCreacion la pone la BD (default getdate()).
    const data = await metaVentaProductoModel.create({
      ...campos,
      UsuarioCreacion: usuarioActual(req),
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear la meta de venta") });
  }
};

const putMetaVentaProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const actual = await metaVentaProductoModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["La meta de venta no existe"] });
    }

    const cambios = leerBody(req.body);
    if (!Object.keys(cambios).length) {
      return res.send({ result: {}, success: false, errors: ["No se enviaron campos para actualizar"] });
    }

    const errores = await validarMeta({ ...actual, ...cambios }, cambios, id);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    const data = await metaVentaProductoModel.update(
      {
        ...cambios,
        FechaModificacion: new Date(),
        UsuarioModificacion: usuarioActual(req),
      },
      { where: { IdMeta: id } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar la meta de venta") });
  }
};

const deleteMetaVentaProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await metaVentaProductoModel.destroy({ where: { IdMeta: id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La meta de venta no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar la meta de venta") });
  }
};

module.exports = {
  getMetasVentaProducto,
  getMetaVentaProducto,
  postMetaVentaProducto,
  putMetaVentaProducto,
  deleteMetaVentaProducto,
};
