const { Op, QueryTypes } = require("sequelize");
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
    Incentivo: body.incentivo,
    minimo: body.minimo,
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
    const {
      anio, mes, idLineaNegocio, idLider, idProveedor, vendedor, articulo,
      linea, lider, proveedor, // por codigo (como vienen en el Excel)
    } = req.query;

    const where = {};
    if (!vacio(anio)) where.Anio = anio;
    if (!vacio(mes)) where.Mes = mes;
    if (!vacio(idLineaNegocio)) where.IdLineaNegocio = idLineaNegocio;
    if (!vacio(idLider)) where.IdLider = idLider;
    if (!vacio(idProveedor)) where.IdProveedor = idProveedor;
    if (!vacio(vendedor)) where.Vendedor = vendedor;
    if (!vacio(articulo)) where.Articulo = { [Op.like]: `%${articulo}%` };
    if (!vacio(linea)) where["$lineaNegocio.codigo$"] = linea;
    if (!vacio(lider)) where["$lider.codigo$"] = lider;
    if (!vacio(proveedor)) where["$proveedor.codigo$"] = proveedor;

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
    // Incentivo y minimo son NOT NULL sin default: 0 y la propia meta.
    const data = await metaVentaProductoModel.create({
      Incentivo: 0,
      minimo: campos.Meta_Unidades,
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

// DELETE /fr/metaVentaProducto/periodo?anio=2026&mes=11&vendedor=VBM
// Borra todas las metas de un periodo (para corregir y volver a subir el Excel).
// anio y mes obligatorios; sin vendedor borra el mes completo de TODOS los
// vendedores, por eso en ese caso exige ademas &todos=true.
const deletePeriodoMetas = async (req, res) => {
  try {
    const { anio, mes, vendedor, todos } = req.query;
    const a = Number(anio);
    const m = Number(mes);
    if (!Number.isInteger(a) || !Number.isInteger(m) || m < 1 || m > 12) {
      return res.send({ result: {}, success: false, errors: ["anio y mes (1 a 12) son obligatorios"] });
    }
    if (vacio(vendedor) && String(todos).toLowerCase() !== "true") {
      return res.send({
        result: {},
        success: false,
        errors: ["Indique el vendedor, o envie todos=true para borrar el mes completo de todos los vendedores"],
      });
    }

    const where = { Anio: a, Mes: m };
    if (!vacio(vendedor)) where.Vendedor = vendedor;
    const eliminadas = await metaVentaProductoModel.destroy({ where });
    if (!eliminadas) {
      return res.send({ result: { eliminadas: 0 }, success: false, errors: ["No hay metas para ese periodo"] });
    }
    res.send({ result: { eliminadas, anio: a, mes: m, vendedor: vendedor || "TODOS" }, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar las metas del periodo") });
  }
};

// POST /fr/metaVentaProducto/actualizarVentas   body (o query): { anio?, mes? }
// Boton de la web: ejecuta CINCOH.sp_ActualizarVentaMetaProducto, que llena Venta_Unidades y
// Venta_Valor de las metas desde CINCOH.FACTURA / FACTURA_LINEA (facturas - devoluciones, no
// anuladas). anio + mes = ese mes; solo anio = todo el anio; nada = todos los periodos con metas.
// El SP pone UsuarioModificacion = usuario SQL (SUSER_SNAME), no el email de la web.
const actualizarVentasMetas = async (req, res) => {
  try {
    const datos = { ...req.query, ...(req.body || {}) };
    const anio = vacio(datos.anio) ? null : Number(datos.anio);
    const mes = vacio(datos.mes) ? null : Number(datos.mes);
    if (anio !== null && (!Number.isInteger(anio) || anio < 2000 || anio > 2100)) {
      return res.send({ result: {}, success: false, errors: ["anio debe ser un numero entre 2000 y 2100"] });
    }
    if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
      return res.send({ result: {}, success: false, errors: ["mes debe ser un numero entre 1 y 12"] });
    }
    if (mes !== null && anio === null) {
      return res.send({ result: {}, success: false, errors: ["Si indica el mes debe indicar tambien el anio"] });
    }

    const inicio = Date.now();
    const [fila] = await metaVentaProductoModel.sequelize.query(
      "EXEC CINCOH.sp_ActualizarVentaMetaProducto @Anio = :anio, @Mes = :mes",
      { replacements: { anio, mes }, type: QueryTypes.SELECT }
    );
    const actualizadas = Number((fila && fila.metas_actualizadas) || 0);

    res.send({
      result: {
        metasActualizadas: actualizadas,
        anio,
        mes,
        alcance: mes ? "mes" : anio ? "anio" : "todos",
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
      },
      success: true,
      mensaje: actualizadas
        ? `Se actualizaron las ventas de ${actualizadas} metas.`
        : "No hay metas en el periodo indicado.",
    });
  } catch (error) {
    console.log(error);
    // RAISERROR / THROW del SP llegan en error.parent.message.
    const detalle = error.parent && error.parent.message;
    res.send({
      result: {},
      success: false,
      errors: [detalle ? `Error al actualizar las ventas de las metas: ${detalle}` : "Error al actualizar las ventas de las metas"],
    });
  }
};

// GET /fr/metaVentaProducto/ventasDiarias?anio=2026&mes=11[&vendedor=VBM][&articulo=16006]
// Solo lectura: ventas del ERP por vendedor, articulo y dia del mes, desde CINCOH.FACTURA +
// FACTURA_LINEA. Mismo criterio que sp_ActualizarVentaMetaProducto (sin anuladas, devoluciones
// 'D' restando, valor = PRECIO_TOTAL - DESC_TOT_GENERAL), asi la suma del mes cuadra con
// Venta_Unidades / Venta_Valor de la meta. SEMANA = semana del mes por dias: 1-7 = 1, 8-14 = 2,
// 15-21 = 3, 22-28 = 4, 29-31 = 5. Solo vienen los dias con movimiento.
const ventasDiarias = async (req, res) => {
  try {
    const anio = Number(req.query.anio);
    const mes = Number(req.query.mes);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      return res.send({ result: {}, success: false, errors: ["anio (2000 a 2100) y mes (1 a 12) son obligatorios"] });
    }
    const vendedor = vacio(req.query.vendedor) ? null : String(req.query.vendedor).trim();
    const articulo = vacio(req.query.articulo) ? null : String(req.query.articulo).trim();

    const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const hasta = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;

    const ventas = await metaVentaProductoModel.sequelize.query(
      `SELECT V.VENDEDOR, VE.NOMBRE AS NOMBRE_VENDEDOR, V.ARTICULO, A.DESCRIPCION AS DESCRIPCION_ARTICULO,
              V.DIA, (V.DIA - 1) / 7 + 1 AS SEMANA,
              CONVERT(varchar(10), DATEFROMPARTS(:anio, :mes, V.DIA), 23) AS FECHA,
              CAST(V.UNIDADES AS float) AS UNIDADES, CAST(V.VALOR AS float) AS VALOR
         FROM (SELECT LTRIM(RTRIM(f.VENDEDOR)) AS VENDEDOR, LTRIM(RTRIM(fl.ARTICULO)) AS ARTICULO,
                      DAY(f.FECHA) AS DIA,
                      SUM(CASE WHEN f.TIPO_DOCUMENTO = 'D' THEN -1 ELSE 1 END * fl.CANTIDAD) AS UNIDADES,
                      SUM(CASE WHEN f.TIPO_DOCUMENTO = 'D' THEN -1 ELSE 1 END
                          * (fl.PRECIO_TOTAL - ISNULL(fl.DESC_TOT_GENERAL, 0))) AS VALOR
                 FROM COAGRO2.CINCOH.FACTURA f
                 JOIN COAGRO2.CINCOH.FACTURA_LINEA fl
                   ON fl.TIPO_DOCUMENTO = f.TIPO_DOCUMENTO AND fl.FACTURA = f.FACTURA
                WHERE f.ANULADA = 'N' AND f.TIPO_DOCUMENTO IN ('F', 'D')
                  AND f.FECHA >= :desde AND f.FECHA < :hasta
                  ${vendedor ? "AND f.VENDEDOR = :vendedor" : ""}
                  ${articulo ? "AND fl.ARTICULO = :articulo" : ""}
                GROUP BY f.VENDEDOR, fl.ARTICULO, DAY(f.FECHA)) V
         LEFT JOIN COAGRO2.CINCOH.VENDEDOR VE ON VE.VENDEDOR = V.VENDEDOR
         LEFT JOIN COAGRO2.CINCOH.ARTICULO A ON A.ARTICULO = V.ARTICULO
        ORDER BY V.VENDEDOR, V.ARTICULO, V.DIA`,
      { replacements: { anio, mes, desde, hasta, vendedor, articulo }, type: QueryTypes.SELECT }
    );

    res.send({
      result: { anio, mes, vendedor, articulo, ventas },
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar las ventas diarias del ERP"] });
  }
};

module.exports = {
  ventasDiarias,
  actualizarVentasMetas,
  deletePeriodoMetas,
  getMetasVentaProducto,
  getMetaVentaProducto,
  postMetaVentaProducto,
  putMetaVentaProducto,
  deleteMetaVentaProducto,
};
