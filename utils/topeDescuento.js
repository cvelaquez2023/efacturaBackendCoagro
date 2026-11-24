//
// Tope del % de descuento de una linea de pedido / cotizacion de la app movil, con el MISMO calculo
// que la app (facturacionRuteoMobile: screens/clientes/PedidoArticulosView.js -> calcular, con
// repositories/descuentos.js y repositories/promociones.js). Lo usa POST /fr/sync/enviar para
// rechazar lineas con un % mayor (app vieja o modificada).
//
// Por linea:
//   cantidad (unidades de almacen) = CNT_MAX + CNT_MIN / ARTICULO.FACTOR_VENTA (si FACTOR_VENTA > 1;
//   si no, solo CNT_MAX). Fecha de referencia = FEC_PED del encabezado (YYYY-MM-DD).
//   A) erpadmin.DESCUENTO_CLIART del cliente y articulo, TIPO 'P', MONTO > 0,
//      FECHA_INICIO <= fecha <= FECHA_FIN y CANT_MIN <= cantidad <= CANT_MAX -> el MONTO mayor.
//   B) erpadmin.FR_PROMOCION ACTIVA = 'S', vigente en la fecha (FECHA_FIN null = no vence), con un
//      destino (FR_PROMOCION_DESTINO) TIPO 'C' = cliente o TIPO 'R' = ruta (la app no mira
//      FR_PROMOCION.DESTINO, solo estas filas). Productos (FR_PROMOCION_PRODUCTO) que incluyen el
//      articulo segun ALCANCE ('A' codigo, 'L' ARTICULO.CLASIFICACION3, 'T' DES_ART contiene VALOR;
//      trim y mayusculas) y cantidad >= CANTIDAD_MIN. % = el mayor entre DESCUENTO y, con
//      PRECIO_ESPECIAL, (1 - PRECIO_ESPECIAL / MON_PRC_MX) * 100, recortado a 0-100. El mayor > 0.
//   Tope = el mayor entre A y B (redondeado a 4 decimales, como la app). Si ninguno aplica:
//   CLIENTE_CIA.DESCUENTO (COD_CLT + COD_CIA). Siempre entre 0 y 100.
//   Con cantidad <= 0 no aplica A ni B (como la app).
//
// Las consultas van en lote para todas las lineas recibidas (no una por linea).

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const txt = (v) => (v === undefined || v === null ? "" : String(v).trim());
const norm = (v) => txt(v).toUpperCase();
const numero = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));
const unicos = (lista) => [...new Set(lista.filter(Boolean))];

// SQL Server limita los parametros por consulta (~2100): las listas largas se consultan por lotes.
const porLotes = async (lista, consulta, tamano = 500) => {
  const salida = [];
  for (let i = 0; i < lista.length; i += tamano) {
    salida.push(...(await consulta(lista.slice(i, i + tamano))));
  }
  return salida;
};

const agruparPor = (filas, clave) => {
  const mapa = new Map();
  for (const f of filas) {
    const k = clave(f);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(f);
  }
  return mapa;
};

// ¿El producto de la promocion incluye al articulo? (repositories/promociones.js -> productoIncluye)
const productoIncluye = (producto, articulo) => {
  const v = norm(producto.VALOR);
  if (!v) return false;
  switch (norm(producto.ALCANCE)) {
    case "A":
      return norm(articulo.COD_ART) === v;
    case "L":
      return norm(articulo.CLASIFICACION3) === v;
    case "T":
      return norm(articulo.DES_ART).includes(v);
    default:
      return false;
  }
};

// % equivalente del producto de promocion (repositories/promociones.js -> porcentajePromocion).
const porcentajePromocion = (producto, precio) => {
  const d = numero(producto.DESCUENTO);
  const desc = d > 0 ? d : 0;
  const especial = numero(producto.PRECIO_ESPECIAL);
  const porEspecial = precio > 0 && especial >= 0 ? (1 - especial / precio) * 100 : 0;
  return Math.min(100, Math.max(0, desc, porEspecial));
};

/**
 * Calcula el tope de cada linea.
 * @param {Array<{ COD_CIA, COD_ZON, COD_CLT, FEC_PED, COD_ART, CNT_MAX, CNT_MIN, MON_PRC_MX }>} lineas
 * @returns {Promise<Array<{ tope: number, cantidad: number }>>} en el mismo orden que `lineas`.
 */
const calcularTopesDescuento = async (lineas) => {
  if (!lineas.length) return [];
  const articulosCod = unicos(lineas.map((l) => txt(l.COD_ART)));
  const clientes = unicos(lineas.map((l) => txt(l.COD_CLT)));
  const rutas = unicos(lineas.map((l) => txt(l.COD_ZON)));

  const [articulos, descuentos, clientesCia, promociones] = await Promise.all([
    porLotes(articulosCod, (lote) =>
      sequelize.query(
        `SELECT LTRIM(RTRIM(COD_ART)) AS COD_ART, FACTOR_VENTA, CLASIFICACION3, DES_ART
           FROM COAGRO2.erpadmin.ARTICULO
          WHERE COD_ART IN (:lote)`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    ),
    // Clientes x articulos: los clientes de un envio son pocos; los articulos van por lotes.
    clientes.length
      ? porLotes(
          articulosCod,
          (lote) =>
            sequelize.query(
              `SELECT LTRIM(RTRIM(CLIENTE)) AS CLIENTE, LTRIM(RTRIM(ARTICULO)) AS ARTICULO,
                      CAST(CANT_MIN AS float) AS CANT_MIN, CAST(CANT_MAX AS float) AS CANT_MAX,
                      CONVERT(varchar(10), FECHA_INICIO, 23) AS FECHA_INICIO,
                      CONVERT(varchar(10), FECHA_FIN, 23) AS FECHA_FIN,
                      CAST(MONTO AS float) AS MONTO
                 FROM COAGRO2.erpadmin.DESCUENTO_CLIART
                WHERE TIPO = 'P' AND MONTO > 0 AND CLIENTE IN (:clientes) AND ARTICULO IN (:lote)`,
              { replacements: { clientes, lote }, type: QueryTypes.SELECT }
            ),
          Math.max(1, 1500 - clientes.length)
        )
      : [],
    porLotes(clientes, (lote) =>
      sequelize.query(
        `SELECT LTRIM(RTRIM(COD_CLT)) AS COD_CLT, LTRIM(RTRIM(COD_CIA)) AS COD_CIA,
                CAST(DESCUENTO AS float) AS DESCUENTO
           FROM COAGRO2.erpadmin.CLIENTE_CIA
          WHERE COD_CLT IN (:lote)`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    ),
    // Promociones activas con algun destino que sea uno de los clientes o rutas del envio.
    sequelize.query(
      `SELECT P.ID, CONVERT(varchar(10), P.FECHA_INICIO, 23) AS FECHA_INICIO,
              CONVERT(varchar(10), P.FECHA_FIN, 23) AS FECHA_FIN
         FROM COAGRO2.erpadmin.FR_PROMOCION P
        WHERE P.ACTIVA = 'S'
          AND EXISTS (SELECT 1 FROM COAGRO2.erpadmin.FR_PROMOCION_DESTINO D
                       WHERE D.PROMOCION_ID = P.ID
                         AND ((D.TIPO = 'C' AND D.VALOR IN (:clientes))
                           OR (D.TIPO = 'R' AND D.VALOR IN (:rutas))))`,
      {
        replacements: { clientes: clientes.length ? clientes : [""], rutas: rutas.length ? rutas : [""] },
        type: QueryTypes.SELECT,
      }
    ),
  ]);

  const ids = promociones.map((p) => p.ID);
  const [destinos, productos] = ids.length
    ? await Promise.all([
        porLotes(ids, (lote) =>
          sequelize.query(
            `SELECT PROMOCION_ID, LTRIM(RTRIM(TIPO)) AS TIPO, LTRIM(RTRIM(VALOR)) AS VALOR
               FROM COAGRO2.erpadmin.FR_PROMOCION_DESTINO
              WHERE PROMOCION_ID IN (:lote) AND TIPO IN ('C', 'R')`,
            { replacements: { lote }, type: QueryTypes.SELECT }
          )
        ),
        porLotes(ids, (lote) =>
          sequelize.query(
            `SELECT PROMOCION_ID, ALCANCE, VALOR, CAST(CANTIDAD_MIN AS float) AS CANTIDAD_MIN,
                    CAST(DESCUENTO AS float) AS DESCUENTO, CAST(PRECIO_ESPECIAL AS float) AS PRECIO_ESPECIAL
               FROM COAGRO2.erpadmin.FR_PROMOCION_PRODUCTO
              WHERE PROMOCION_ID IN (:lote)`,
            { replacements: { lote }, type: QueryTypes.SELECT }
          )
        ),
      ])
    : [[], []];

  // erpadmin.ARTICULO puede repetir COD_ART: se toma la primera fila.
  const articuloDe = new Map();
  for (const a of articulos) if (!articuloDe.has(norm(a.COD_ART))) articuloDe.set(norm(a.COD_ART), a);
  const descuentosDe = agruparPor(descuentos, (d) => `${norm(d.CLIENTE)}|${norm(d.ARTICULO)}`);
  const descuentoCliente = new Map(clientesCia.map((c) => [`${norm(c.COD_CLT)}|${norm(c.COD_CIA)}`, numero(c.DESCUENTO)]));
  const destinosDe = agruparPor(destinos, (d) => d.PROMOCION_ID);
  const productosDe = agruparPor(productos, (p) => p.PROMOCION_ID);

  return lineas.map((l) => {
    const codArt = norm(l.COD_ART);
    const cliente = norm(l.COD_CLT);
    const ruta = norm(l.COD_ZON);
    const fecha = txt(l.FEC_PED).slice(0, 10);
    const precio = numero(l.MON_PRC_MX);
    const art = articuloDe.get(codArt) || { COD_ART: l.COD_ART };
    const factor = numero(art.FACTOR_VENTA);
    const cantidad = (numero(l.CNT_MAX) || 0) + (factor > 1 ? (numero(l.CNT_MIN) || 0) / factor : 0);

    let mejor = null;
    if (cantidad > 0) {
      // A) Descuento del cliente por articulo.
      for (const d of descuentosDe.get(`${cliente}|${codArt}`) || []) {
        if (d.FECHA_INICIO > fecha || d.FECHA_FIN < fecha) continue;
        if (cantidad < d.CANT_MIN || cantidad > d.CANT_MAX) continue;
        if (mejor === null || d.MONTO > mejor) mejor = d.MONTO;
      }
      // B) Promociones del cliente o de su ruta.
      for (const p of promociones) {
        if ((p.FECHA_INICIO && p.FECHA_INICIO > fecha) || (p.FECHA_FIN && p.FECHA_FIN < fecha)) continue;
        const dirigida = (destinosDe.get(p.ID) || []).some(
          (d) => (norm(d.TIPO) === "C" && norm(d.VALOR) === cliente) || (norm(d.TIPO) === "R" && norm(d.VALOR) === ruta)
        );
        if (!dirigida) continue;
        for (const prod of productosDe.get(p.ID) || []) {
          if (!productoIncluye(prod, art) || cantidad < (numero(prod.CANTIDAD_MIN) || 0)) continue;
          const porc = porcentajePromocion(prod, precio);
          if (porc > 0 && (mejor === null || porc > mejor)) mejor = porc;
        }
      }
    }

    const general = descuentoCliente.get(`${cliente}|${norm(l.COD_CIA)}`);
    const tope = mejor !== null ? Math.round(mejor * 10000) / 10000 : Number.isFinite(general) ? general : 0;
    return { tope: Math.min(100, Math.max(0, tope)), cantidad };
  });
};

module.exports = { calcularTopesDescuento, productoIncluye, porcentajePromocion };
