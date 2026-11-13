/**
 * Calculo de precio del modulo de rutas (fr): web (/fr/precioVigente) y, en
 * la Fase 2, la sincronizacion de la app (/fr/sync/promociones). Las dos deben
 * dar el mismo precio, por eso la regla vive SOLO aqui.
 *
 * Regla:
 *   precio base del nivel de precio del cliente
 *   -> se buscan las reglas ACTIVAS y VIGENTES en la fecha
 *      (condiciones del cliente + promociones dirigidas a el)
 *   -> gana la que deja el precio MAS BAJO. Los descuentos NO se suman.
 *   -> si ninguna regla baja el precio base, se queda el precio base.
 *
 * Bonificaciones (promocion TIPO B) no cambian el precio: se devuelven aparte
 * en `bonificaciones` si el producto y la cantidad minima aplican.
 *
 * Alcance de un producto (ALCANCE/VALOR):
 *   A = codigo de articulo exacto
 *   L = linea del articulo (CLASIFICACION_3 del ERP)
 *   T = texto contenido en la descripcion del articulo (sin distinguir mayusculas)
 *
 * `calcularPrecio` es PURA (no toca la BD) para poder reusarla en la sync.
 * `obtenerPrecioVigente` carga los datos de la BD y llama a `calcularPrecio`.
 */
const { QueryTypes, Op } = require("sequelize");
const { sequelize } = require("../config/mssql");

const txt = (v) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
const redondear = (v) => (v === null ? null : Math.round(v * 100) / 100);

// Fecha local en formato YYYY-MM-DD (DATE de SQL Server).
const hoyISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const soloFecha = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

// FECHA_FIN null = no vence.
const esVigente = (regla, fecha) => {
  const ini = soloFecha(regla.FECHA_INICIO);
  const fin = soloFecha(regla.FECHA_FIN);
  return (!ini || ini <= fecha) && (!fin || fin >= fecha);
};

// ¿La regla (ALCANCE/VALOR) aplica al articulo { articulo, linea, descripcion }?
const aplicaAlArticulo = (regla, art) => {
  const valor = txt(regla.VALOR).toUpperCase();
  if (!valor) return false;
  switch (txt(regla.ALCANCE)) {
    case "A":
      return txt(art.articulo).toUpperCase() === valor;
    case "L":
      return txt(art.linea).toUpperCase() === valor;
    case "T":
      return txt(art.descripcion).toUpperCase().includes(valor);
    default:
      return false;
  }
};

const cumpleCantidad = (regla, cantidad) => {
  const min = num(regla.CANTIDAD_MIN);
  return min === null || cantidad >= min;
};

// ¿La promocion va dirigida a este cliente? destinos: [{ TIPO, VALOR }]
const aplicaDestino = (promo, { cliente, rutas, tipoCliente }) => {
  const destino = txt(promo.DESTINO);
  if (destino === "T") return true;
  const valores = (promo.destinos || [])
    .filter((d) => txt(d.TIPO) === destino)
    .map((d) => txt(d.VALOR).toUpperCase());
  if (destino === "C") return !!cliente && valores.includes(txt(cliente).toUpperCase());
  if (destino === "K") return !!tipoCliente && valores.includes(txt(tipoCliente).toUpperCase());
  if (destino === "R") return (rutas || []).some((r) => valores.includes(txt(r).toUpperCase()));
  return false;
};

/**
 * @param {object} p
 * @param {number|null} p.precioBase   precio del nivel del cliente (null si no tiene)
 * @param {{articulo:string, linea?:string, descripcion?:string}} p.articulo
 * @param {number} [p.cantidad=1]
 * @param {string} [p.fecha]           YYYY-MM-DD, hoy por defecto
 * @param {string} [p.cliente]
 * @param {string[]} [p.rutas]
 * @param {string} [p.tipoCliente]
 * @param {object[]} [p.condiciones]   filas de FR_CONDICION_CLIENTE del cliente
 * @param {object[]} [p.promociones]   filas de FR_PROMOCION con `productos` y `destinos`
 */
const calcularPrecio = ({
  precioBase,
  articulo,
  cantidad = 1,
  fecha = hoyISO(),
  cliente,
  rutas = [],
  tipoCliente,
  condiciones = [],
  promociones = [],
}) => {
  const base = num(precioBase);
  const candidatas = [];
  const bonificaciones = [];

  const agregar = (origen, id, descripcion, precio, extra = {}) => {
    if (precio === null || Number.isNaN(precio)) return;
    candidatas.push({ origen, id, descripcion, precio: redondear(precio), ...extra });
  };

  // 1) Condiciones especiales del cliente
  for (const c of condiciones) {
    if (txt(c.ACTIVA) !== "S" || !esVigente(c, fecha)) continue;
    if (cliente && txt(c.CLIENTE).toUpperCase() !== txt(cliente).toUpperCase()) continue;
    if (!aplicaAlArticulo(c, articulo) || !cumpleCantidad(c, cantidad)) continue;

    const desc = num(c.DESCUENTO_MAX);
    const especial = num(c.PRECIO_ESPECIAL);
    if (desc !== null && base !== null) {
      agregar("CONDICION", c.ID, `Descuento maximo ${desc}% (${c.ALCANCE}: ${c.VALOR})`, base * (1 - desc / 100), { descuento: desc });
    }
    if (especial !== null) {
      agregar("CONDICION", c.ID, `Precio especial (${c.ALCANCE}: ${c.VALOR})`, especial);
    }
  }

  // 2) Promociones de temporada dirigidas al cliente
  for (const p of promociones) {
    if (txt(p.ACTIVA) !== "S" || !esVigente(p, fecha)) continue;
    if (!aplicaDestino(p, { cliente, rutas, tipoCliente })) continue;

    for (const prod of p.productos || []) {
      if (!aplicaAlArticulo(prod, articulo) || !cumpleCantidad(prod, cantidad)) continue;

      const tipo = txt(p.TIPO);
      if (tipo === "D" && num(prod.DESCUENTO) !== null && base !== null) {
        const d = num(prod.DESCUENTO);
        agregar("PROMOCION", p.ID, `${p.TITULO}: ${d}% de descuento`, base * (1 - d / 100), { descuento: d });
      } else if (tipo === "P" && num(prod.PRECIO_ESPECIAL) !== null) {
        agregar("PROMOCION", p.ID, `${p.TITULO}: precio especial`, num(prod.PRECIO_ESPECIAL));
      } else if (tipo === "B") {
        bonificaciones.push({
          promocionId: p.ID,
          titulo: p.TITULO,
          cantidadMin: num(prod.CANTIDAD_MIN),
          articuloBonificado: p.ARTICULO_BONIFICADO,
          cantidadBonificada: num(p.CANTIDAD_BONIFICADA),
        });
        break; // una bonificacion por promocion aunque varios productos coincidan
      }
    }
  }

  // 3) Gana el precio mas bajo; si ninguna regla baja el base, queda el base.
  candidatas.sort((a, b) => a.precio - b.precio);
  let reglaAplicada = null;
  let precioFinal = base === null ? null : redondear(base);
  if (candidatas.length && (precioFinal === null || candidatas[0].precio < precioFinal)) {
    reglaAplicada = candidatas[0];
    precioFinal = candidatas[0].precio;
  }

  return {
    precioBase: base === null ? null : redondear(base),
    precioFinal,
    descuentoEfectivo:
      base && precioFinal !== null ? redondear(((base - precioFinal) / base) * 100) : null,
    reglaAplicada,
    candidatas,
    bonificaciones,
  };
};

/**
 * Carga de la BD lo necesario y calcula el precio de un articulo para un cliente.
 * Precio base: erpadmin.ARTICULO_PRECIO (mismo origen que la sync de la app) del
 * nivel del cliente (erpadmin.cliente.NIVEL_PRECIO) o del `nivelPrecio` enviado.
 * Datos del articulo (linea = CLASIFICACION_3): CINCOH.ARTICULO.
 */
const obtenerPrecioVigente = async ({
  cliente,
  articulo,
  fecha = hoyISO(),
  cantidad = 1,
  rutas = [],
  tipoCliente,
  nivelPrecio,
}) => {
  // Se requieren aqui para evitar dependencia circular models <-> utils.
  const { frCondicionClienteModel, frPromocionModel } = require("../models");
  const avisos = [];

  const [art] = await sequelize.query(
    `SELECT ARTICULO, DESCRIPCION, CLASIFICACION_3 FROM CINCOH.ARTICULO WHERE ARTICULO = :articulo`,
    { replacements: { articulo }, type: QueryTypes.SELECT }
  );
  if (!art) return { error: `El articulo ${articulo} no existe` };

  let nivel = txt(nivelPrecio);
  if (!nivel && cliente) {
    const [cli] = await sequelize.query(
      `SELECT TOP 1 NIVEL_PRECIO FROM COAGRO2.erpadmin.cliente
        WHERE COD_CLT = :cliente AND NIVEL_PRECIO IS NOT NULL`,
      { replacements: { cliente }, type: QueryTypes.SELECT }
    );
    nivel = cli ? txt(cli.NIVEL_PRECIO) : "";
    if (!nivel) avisos.push(`El cliente ${cliente} no tiene nivel de precio; no hay precio base.`);
  }

  let precioBase = null;
  if (nivel) {
    const [precio] = await sequelize.query(
      `SELECT TOP 1 PRECIO FROM COAGRO2.erpadmin.ARTICULO_PRECIO
        WHERE ARTICULO = :articulo AND NIVEL_PRECIO = :nivel
        ORDER BY VERSION DESC, VERSION_ARTICULO DESC`,
      { replacements: { articulo, nivel }, type: QueryTypes.SELECT }
    );
    precioBase = precio ? num(precio.PRECIO) : null;
    if (precioBase === null) avisos.push(`El articulo ${articulo} no tiene precio en el nivel ${nivel}.`);
  }

  const vigenteWhere = {
    ACTIVA: "S",
    FECHA_INICIO: { [Op.lte]: fecha },
  };

  const condiciones = cliente
    ? await frCondicionClienteModel.findAll({
        where: { ...vigenteWhere, CLIENTE: cliente, [Op.or]: [{ FECHA_FIN: null }, { FECHA_FIN: { [Op.gte]: fecha } }] },
        raw: true,
      })
    : [];

  const promociones = (
    await frPromocionModel.findAll({
      where: { ...vigenteWhere, FECHA_FIN: { [Op.gte]: fecha } },
      include: [{ association: "productos" }, { association: "destinos" }],
    })
  ).map((p) => p.get({ plain: true }));

  const resultado = calcularPrecio({
    precioBase,
    articulo: { articulo: art.ARTICULO, linea: art.CLASIFICACION_3, descripcion: art.DESCRIPCION },
    cantidad,
    fecha,
    cliente,
    rutas,
    tipoCliente,
    condiciones,
    promociones,
  });

  return {
    cliente: cliente || null,
    articulo: art.ARTICULO,
    descripcion: art.DESCRIPCION,
    linea: art.CLASIFICACION_3,
    nivelPrecio: nivel || null,
    fecha,
    cantidad,
    ...resultado,
    avisos,
  };
};

module.exports = {
  calcularPrecio,
  obtenerPrecioVigente,
  aplicaAlArticulo,
  aplicaDestino,
  esVigente,
  hoyISO,
};
