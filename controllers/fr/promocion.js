const { Op } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const {
  frPromocionModel,
  frPromocionProductoModel,
  frPromocionDestinoModel,
  rutaRtModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");
const { vacio, toSN, usuarioActual, existeArticulo, validarAlcanceValor } = require("../../utils/alcanceFr");

// Traduce los errores de Sequelize/SQL Server a mensajes claros para el cliente.
const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return ["Un valor supera el tamano permitido. TITULO: max 120, DESCRIPCION: max 500, VALOR y ARTICULO_BONIFICADO: max 60."];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Hay un destino repetido en la promocion."];
  }
  if (error.parent && error.parent.number === 547) {
    return ["Los datos no cumplen las reglas de la tabla (revisa fechas, tipo, bonificacion, descuento 0-100 y montos mayores que 0)."];
  }
  return [fallback];
};

const TIPOS_DESTINO = { R: "ruta", K: "tipo de cliente", C: "cliente" };

const limpiar = (v) => {
  if (v === "") return null;
  return typeof v === "string" ? v.trim() : v;
};

// Encabezado: camelCase -> columnas. Solo los campos que vienen.
const leerEncabezado = (body) => {
  const mapa = {
    titulo: "TITULO",
    descripcion: "DESCRIPCION",
    tipo: "TIPO",
    fechaInicio: "FECHA_INICIO",
    fechaFin: "FECHA_FIN",
    destino: "DESTINO",
    articuloBonificado: "ARTICULO_BONIFICADO",
    cantidadBonificada: "CANTIDAD_BONIFICADA",
  };
  const campos = {};
  for (const [js, db] of Object.entries(mapa)) {
    if (body[js] === undefined) continue;
    let v = limpiar(body[js]);
    if (["TIPO", "DESTINO"].includes(db) && v) v = String(v).toUpperCase();
    campos[db] = v;
  }
  const activa = toSN(body.activa);
  if (activa) campos.ACTIVA = activa;
  return campos;
};

const leerProductos = (lista) =>
  (lista || []).map((p) => ({
    ALCANCE: p.alcance ? String(p.alcance).trim().toUpperCase() : null,
    VALOR: limpiar(p.valor),
    CANTIDAD_MIN: vacio(p.cantidadMin) ? null : p.cantidadMin,
    DESCUENTO: vacio(p.descuento) ? null : p.descuento,
    PRECIO_ESPECIAL: vacio(p.precioEspecial) ? null : p.precioEspecial,
  }));

// destinos: ["R001", ...] o [{ valor: "R001" }]. El TIPO siempre es el DESTINO del encabezado.
const leerDestinos = (lista, destino) => {
  const valores = (lista || [])
    .map((d) => limpiar(typeof d === "object" && d !== null ? d.valor : d))
    .filter((v) => !vacio(v));
  return [...new Set(valores)].map((VALOR) => ({ TIPO: destino, VALOR }));
};

/**
 * Valida la promocion completa (encabezado final + productos + destinos).
 * `productos`/`destinos` en null = no se tocan (PUT parcial) y no se validan.
 */
const validarPromocion = async (p, productos, destinos) => {
  const errores = [];
  for (const k of ["TITULO", "TIPO", "FECHA_INICIO", "FECHA_FIN", "DESTINO"]) {
    if (vacio(p[k])) errores.push(`${k} es obligatorio`);
  }
  if (!vacio(p.FECHA_INICIO) && !vacio(p.FECHA_FIN) && String(p.FECHA_FIN) < String(p.FECHA_INICIO)) {
    errores.push("FECHA_FIN no puede ser menor que FECHA_INICIO");
  }
  if (p.TIPO === "B") {
    if (vacio(p.ARTICULO_BONIFICADO) || vacio(p.CANTIDAD_BONIFICADA)) {
      errores.push("Una bonificacion requiere articuloBonificado y cantidadBonificada");
    } else if (!(await existeArticulo(p.ARTICULO_BONIFICADO))) {
      errores.push(`El articulo bonificado ${p.ARTICULO_BONIFICADO} no existe en el ERP`);
    }
  }

  if (productos) {
    if (!productos.length) errores.push("La promocion debe tener al menos un producto");
    for (const [i, prod] of productos.entries()) {
      const pre = `Producto ${i + 1}: `;
      if (!["A", "L", "T"].includes(prod.ALCANCE)) {
        errores.push(`${pre}alcance debe ser A, L o T`);
        continue;
      }
      if (vacio(prod.VALOR)) {
        errores.push(`${pre}valor es obligatorio`);
        continue;
      }
      if (p.TIPO === "D" && vacio(prod.DESCUENTO)) errores.push(`${pre}una promocion de descuento requiere descuento`);
      if (p.TIPO === "P" && vacio(prod.PRECIO_ESPECIAL)) errores.push(`${pre}una promocion de precio especial requiere precioEspecial`);
      const e = await validarAlcanceValor(prod.ALCANCE, prod.VALOR, pre);
      if (e) errores.push(e);
    }
  }

  if (destinos && p.DESTINO !== "T") {
    if (!destinos.length) {
      errores.push(`Debe indicar al menos un destino (${TIPOS_DESTINO[p.DESTINO] || p.DESTINO})`);
    }
    if (p.DESTINO === "R") {
      for (const d of destinos) {
        const ruta = await rutaRtModel.findOne({ where: { RUTA: d.VALOR }, raw: true });
        if (!ruta) errores.push(`La ruta ${d.VALOR} no existe en el modulo de rutas`);
      }
    }
    // K (tipo de cliente) y C (cliente): sin validar hasta que existan sus tablas
    // (ver docs/pendientes-fr-promociones.sql).
  }
  return errores;
};

// Carga productos y destinos de una lista de promociones.
const conDetalle = async (promos) => {
  const ids = promos.map((p) => p.ID);
  if (!ids.length) return promos;
  const [productos, destinos] = await Promise.all([
    frPromocionProductoModel.findAll({ where: { PROMOCION_ID: ids }, order: [["ID", "ASC"]], raw: true }),
    frPromocionDestinoModel.findAll({ where: { PROMOCION_ID: ids }, order: [["VALOR", "ASC"]], raw: true }),
  ]);
  return promos.map((p) => ({
    ...p,
    productos: productos.filter((x) => x.PROMOCION_ID === p.ID),
    destinos: destinos.filter((x) => x.PROMOCION_ID === p.ID),
  }));
};

// GET /fr/promocion?tipo=&destino=&activa=&vigente=YYYY-MM-DD&q=&page=&limit=
const getPromociones = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const { tipo, destino, vigente, q } = req.query;
    const activa = toSN(req.query.activa);

    const where = {};
    if (!vacio(tipo)) where.TIPO = String(tipo).toUpperCase();
    if (!vacio(destino)) where.DESTINO = String(destino).toUpperCase();
    if (activa) where.ACTIVA = activa;
    if (!vacio(q)) {
      where[Op.or] = [{ TITULO: { [Op.like]: `%${q}%` } }, { DESCRIPCION: { [Op.like]: `%${q}%` } }];
    }
    if (!vacio(vigente)) {
      where.FECHA_INICIO = { [Op.lte]: vigente };
      where.FECHA_FIN = { [Op.gte]: vigente };
    }

    const data = await frPromocionModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["FECHA_INICIO", "DESC"],
        ["ID", "DESC"],
      ],
      raw: true,
    });
    data.rows = await conDetalle(data.rows);
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar las promociones") });
  }
};

const getPromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await frPromocionModel.findByPk(id, { raw: true });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La promocion no existe"] });
    }
    const [completa] = await conDetalle([data]);
    res.send({ result: completa, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al consultar la promocion") });
  }
};

/**
 * POST /fr/promocion
 * { titulo, descripcion, tipo, fechaInicio, fechaFin, destino, articuloBonificado,
 *   cantidadBonificada, activa, productos: [{ alcance, valor, cantidadMin, descuento,
 *   precioEspecial }], destinos: ["R001", ...] }
 */
const postPromocion = async (req, res) => {
  try {
    const enc = leerEncabezado(req.body);
    if (enc.TIPO !== "B") {
      enc.ARTICULO_BONIFICADO = null;
      enc.CANTIDAD_BONIFICADA = null;
    }
    const productos = leerProductos(req.body.productos);
    const destinos = enc.DESTINO === "T" ? [] : leerDestinos(req.body.destinos, enc.DESTINO);

    const errores = await validarPromocion(enc, productos, destinos);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    const id = await sequelize.transaction(async (transaction) => {
      // FECHA_CREACION la pone la BD (default getdate()).
      const promo = await frPromocionModel.create(
        { ...enc, ACTIVA: enc.ACTIVA || "S", CREADO_POR: usuarioActual(req) },
        { transaction }
      );
      for (const prod of productos) {
        await frPromocionProductoModel.create({ ...prod, PROMOCION_ID: promo.ID }, { transaction });
      }
      for (const d of destinos) {
        await frPromocionDestinoModel.create({ ...d, PROMOCION_ID: promo.ID }, { transaction });
      }
      return promo.ID;
    });

    const [completa] = await conDetalle([await frPromocionModel.findByPk(id, { raw: true })]);
    res.send({ result: completa, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al crear la promocion") });
  }
};

/**
 * PUT /fr/promocion/:id  (parcial)
 * Si viene `productos`, reemplaza TODOS los productos; si viene `destinos`, reemplaza
 * TODOS los destinos. Si no vienen, se quedan como estan.
 */
const putPromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const actual = await frPromocionModel.findByPk(id, { raw: true });
    if (!actual) {
      return res.send({ result: {}, success: false, errors: ["La promocion no existe"] });
    }

    const cambios = leerEncabezado(req.body);
    const final = { ...actual, ...cambios };

    // Si deja de ser bonificacion, se limpian los campos de bonificacion (CHECK de la BD).
    if (final.TIPO !== "B") {
      cambios.ARTICULO_BONIFICADO = final.ARTICULO_BONIFICADO = null;
      cambios.CANTIDAD_BONIFICADA = final.CANTIDAD_BONIFICADA = null;
    }

    const actualDetalle = (await conDetalle([actual]))[0];
    const cambiaTipo = cambios.TIPO !== undefined && cambios.TIPO !== actual.TIPO;
    const cambiaDestino = cambios.DESTINO !== undefined && cambios.DESTINO !== actual.DESTINO;

    let productos = req.body.productos !== undefined ? leerProductos(req.body.productos) : null;
    // Si cambia el tipo, los productos actuales se revalidan (ej D -> P exige precioEspecial).
    const productosAValidar = productos || (cambiaTipo ? actualDetalle.productos : null);

    let destinos = null;
    if (final.DESTINO === "T") {
      destinos = []; // "todos": no lleva destinos, se borran los que hubiera
    } else if (req.body.destinos !== undefined) {
      destinos = leerDestinos(req.body.destinos, final.DESTINO);
    } else if (cambiaDestino) {
      return res.send({
        result: {},
        success: false,
        errors: ["Al cambiar el destino debe enviar la nueva lista de destinos"],
      });
    }

    const errores = await validarPromocion(final, productosAValidar, destinos);
    if (errores.length) {
      return res.send({ result: {}, success: false, errors: errores });
    }

    await sequelize.transaction(async (transaction) => {
      // omitNull:false para poder limpiar DESCRIPCION o los campos de bonificacion.
      await frPromocionModel.update(
        { ...cambios, MODIFICADO_POR: usuarioActual(req), FECHA_MODIFICACION: new Date() },
        { where: { ID: id }, omitNull: false, transaction }
      );
      if (productos) {
        await frPromocionProductoModel.destroy({ where: { PROMOCION_ID: id }, transaction });
        for (const prod of productos) {
          await frPromocionProductoModel.create({ ...prod, PROMOCION_ID: id }, { transaction });
        }
      }
      if (destinos) {
        await frPromocionDestinoModel.destroy({ where: { PROMOCION_ID: id }, transaction });
        for (const d of destinos) {
          await frPromocionDestinoModel.create({ ...d, PROMOCION_ID: id }, { transaction });
        }
      }
    });

    const [completa] = await conDetalle([await frPromocionModel.findByPk(id, { raw: true })]);
    res.send({ result: completa, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al actualizar la promocion") });
  }
};

// Productos y destinos se borran solos (FK con ON DELETE CASCADE).
const deletePromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await frPromocionModel.destroy({ where: { ID: id } });
    if (!data) {
      return res.send({ result: {}, success: false, errors: ["La promocion no existe"] });
    }
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: parseErrores(error, "Error al eliminar la promocion") });
  }
};

module.exports = {
  getPromociones,
  getPromocion,
  postPromocion,
  putPromocion,
  deletePromocion,
};
