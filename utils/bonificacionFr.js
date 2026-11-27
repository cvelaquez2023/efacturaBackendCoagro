//
// Bonificacion permitida en los pedidos que sube la app (POST /fr/sync/enviar), para revisar las
// lineas regaladas (ART_BON = '1'): el vendedor no puede regalar mas de lo que dan las promociones.
//
// Regla: la MISMA de la web y de la app (utils/precioFr.js -> calcularPrecio, promociones TIPO 'B'):
//   - Promociones ACTIVA 'S', vigentes en FEC_PED, dirigidas al pedido: DESTINO T, R (ruta del pedido
//     = COD_ZON), C (COD_CLT) o K (CLIENTE_CIA.COD_TIP_CL del cliente).
//   - Por cada articulo VENDIDO (lineas con ART_BON distinto de '1'; si el articulo va en varias
//     lineas se suman): veces = floor(cantidad / CANTIDAD_MIN) del producto de la promocion que lo
//     incluye (ALCANCE A codigo, L CLASIFICACION3, T texto en DES_ART), y se permite
//     CANTIDAD * veces de cada articulo de FR_PROMOCION_BONIFICADO. Los productos no se suman entre si.
//   - Lo permitido de varias promociones se suma por articulo regalado.
//   cantidad = CNT_MAX + CNT_MIN / FACTOR_VENTA (si FACTOR_VENTA > 1; si no, solo CNT_MAX), igual que
//   utils/topeDescuento.js.
// Regalar MENOS de lo permitido esta bien; mas, no.
//
// Solo se consulta la BD para los pedidos que traen alguna linea con ART_BON = '1' (la app vieja
// nunca las manda), en lote para todo el envio.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { calcularPrecio } = require("./precioFr");

const txt = (v) => (v === undefined || v === null ? "" : String(v).trim());
const norm = (v) => txt(v).toUpperCase();
const unicos = (lista) => [...new Set(lista.filter(Boolean))];
const esBonificada = (l) => txt(l && l.ART_BON) === "1";
const lineasDe = (p) => (Array.isArray(p && p.lineas) ? p.lineas : []);

// SQL Server limita los parametros por consulta (~2100): las listas largas se consultan por lotes.
const porLotes = async (lista, consulta, tamano = 500) => {
  const salida = [];
  for (let i = 0; i < lista.length; i += tamano) {
    salida.push(...(await consulta(lista.slice(i, i + tamano))));
  }
  return salida;
};

const cantidadLinea = (l, art) => {
  const factor = Number(art && art.FACTOR_VENTA) || 0;
  return (Number(l.CNT_MAX) || 0) + (factor > 1 ? (Number(l.CNT_MIN) || 0) / factor : 0);
};

const pedidoConBonificacion = (p) => lineasDe(p).some(esBonificada);

/**
 * @param {Array<{ encabezado, lineas }>} pedidos  los del envio
 * @returns {Promise<Map<object, Map<string, number>>>} pedido -> (COD_ART regalado en mayusculas ->
 *          cantidad permitida). Solo trae los pedidos con alguna linea ART_BON = '1'.
 */
const calcularBonificacionesPermitidas = async (pedidos) => {
  const resultado = new Map();
  const conBonif = pedidos.filter(pedidoConBonificacion);
  if (!conBonif.length) return resultado;

  const codigos = unicos(conBonif.flatMap((p) => lineasDe(p).map((l) => txt(l && l.COD_ART))));
  const clientes = unicos(conBonif.map((p) => txt(p.encabezado && p.encabezado.COD_CLT)));

  const [articulos, tipos, promos] = await Promise.all([
    porLotes(codigos, (lote) =>
      sequelize.query(
        `SELECT LTRIM(RTRIM(COD_ART)) AS COD_ART, FACTOR_VENTA, CLASIFICACION3, DES_ART
           FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART IN (:lote)`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    ),
    porLotes(clientes, (lote) =>
      sequelize.query(
        `SELECT LTRIM(RTRIM(COD_CLT)) AS COD_CLT, LTRIM(RTRIM(COD_TIP_CL)) AS COD_TIP_CL, COD_CIA
           FROM COAGRO2.erpadmin.CLIENTE_CIA WHERE COD_CLT IN (:lote)
          ORDER BY CASE WHEN COD_CIA = 'CINCOH' THEN 0 ELSE 1 END`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    ),
    sequelize.query(
      `SELECT ID, TITULO, TIPO, DESTINO, ACTIVA,
              CONVERT(varchar(10), FECHA_INICIO, 23) AS FECHA_INICIO, CONVERT(varchar(10), FECHA_FIN, 23) AS FECHA_FIN
         FROM COAGRO2.erpadmin.FR_PROMOCION
        WHERE TIPO = 'B' AND ACTIVA = 'S'`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  const ids = promos.map((p) => p.ID);
  const [productos, destinos, bonificados] = ids.length
    ? await Promise.all(
        ["FR_PROMOCION_PRODUCTO", "FR_PROMOCION_DESTINO", "FR_PROMOCION_BONIFICADO"].map((tabla) =>
          sequelize.query(`SELECT * FROM COAGRO2.erpadmin.${tabla} WHERE PROMOCION_ID IN (:ids)`, {
            replacements: { ids },
            type: QueryTypes.SELECT,
          })
        )
      )
    : [[], [], []];
  const promociones = promos.map((p) => ({
    ...p,
    productos: productos.filter((x) => x.PROMOCION_ID === p.ID),
    destinos: destinos.filter((x) => x.PROMOCION_ID === p.ID),
    bonificados: bonificados.filter((x) => x.PROMOCION_ID === p.ID),
  }));

  const articuloDe = new Map(articulos.map((a) => [norm(a.COD_ART), a]));
  const tipoDe = new Map();
  for (const t of tipos) if (!tipoDe.has(norm(t.COD_CLT))) tipoDe.set(norm(t.COD_CLT), t.COD_TIP_CL);

  for (const p of conBonif) {
    const enc = p.encabezado || {};
    const fecha = txt(enc.FEC_PED).slice(0, 10);
    // Cantidad vendida por articulo (varias lineas del mismo articulo se suman).
    const vendido = new Map();
    for (const l of lineasDe(p)) {
      if (!l || esBonificada(l)) continue;
      const k = norm(l.COD_ART);
      vendido.set(k, (vendido.get(k) || 0) + cantidadLinea(l, articuloDe.get(k)));
    }
    const permitido = new Map();
    for (const [codArt, cantidad] of vendido) {
      if (!(cantidad > 0)) continue;
      const art = articuloDe.get(codArt) || { COD_ART: codArt };
      const { bonificaciones } = calcularPrecio({
        precioBase: null,
        articulo: { articulo: art.COD_ART, linea: art.CLASIFICACION3, descripcion: art.DES_ART },
        cantidad,
        fecha,
        cliente: txt(enc.COD_CLT),
        rutas: [txt(enc.COD_ZON)],
        tipoCliente: tipoDe.get(norm(enc.COD_CLT)),
        promociones,
      });
      for (const b of bonificaciones) {
        for (const a of b.articulos) {
          const k = norm(a.articulo);
          permitido.set(k, (permitido.get(k) || 0) + (Number(a.cantidad) || 0));
        }
      }
    }
    // Cantidad regalada pedida, con el mismo factor que las vendidas.
    const regalado = new Map();
    for (const l of lineasDe(p)) {
      if (!esBonificada(l)) continue;
      const k = norm(l.COD_ART);
      regalado.set(k, (regalado.get(k) || 0) + cantidadLinea(l, articuloDe.get(k)));
    }
    resultado.set(p, { permitido, regalado });
  }
  return resultado;
};

const redondeo = (n) => Math.round(n * 10000) / 10000;
const TOLERANCIA = 0.0001;

// Mensaje del primer articulo regalado de mas; null si todo cuadra (o el pedido no trae regalos).
const errorBonificacion = (calculo, NUM_PED) => {
  if (!calculo) return null;
  for (const [codArt, cantidad] of calculo.regalado) {
    const permitida = calculo.permitido.get(codArt) || 0;
    if (cantidad > permitida + TOLERANCIA) {
      return permitida > 0
        ? `Pedido ${NUM_PED}: la bonificacion de ${codArt} (${redondeo(cantidad)}) supera la que dan las promociones (${redondeo(permitida)})`
        : `Pedido ${NUM_PED}: ninguna promocion vigente regala ${codArt} con lo que lleva el pedido`;
    }
  }
  return null;
};

// Forma de las lineas (sin BD), acordada con la app (nov 2026):
//   - ART_BON '0' (vendida) o '1' (regalada); vacio = vendida.
//   - La regalada va sin montos: MON_PRC_MX, MON_PRC_MN, MON_TOT, MON_DSC y POR_DSC_AP en 0 (lleva los
//     porcentajes de impuesto del articulo). Una linea por articulo regalado (si vinieran varias, se suman).
const MONTOS_EN_CERO = ["MON_PRC_MX", "MON_PRC_MN", "MON_TOT", "MON_DSC", "POR_DSC_AP"];
const errorLineasBonificadas = (p, NUM_PED) => {
  for (const [i, l] of lineasDe(p).entries()) {
    if (!l) continue;
    const bon = txt(l.ART_BON);
    const ref = `Pedido ${NUM_PED}, linea ${txt(l.NUM_LN) || i + 1} (${txt(l.COD_ART)})`;
    if (!["", "0", "1"].includes(bon)) return `${ref}: ART_BON debe ser 0 (vendida) o 1 (regalada)`;
    if (bon !== "1") continue;
    const conMonto = MONTOS_EN_CERO.filter((c) => Math.abs(Number(l[c]) || 0) > TOLERANCIA);
    if (conMonto.length) return `${ref}: la linea regalada debe ir con ${conMonto.join(", ")} en 0`;
  }
  return null;
};

module.exports = { calcularBonificacionesPermitidas, errorBonificacion, errorLineasBonificadas, pedidoConBonificacion };
