//
// Endpoint de sincronización para la handheld. Tablas:
//   - rutaCliente          -> qué clientes van en cada ruta, día y orden
//   - erpadmin.cliente     -> datos del cliente (nombre, dirección, etc.)
//   - rutaRt               -> SOLO el nombre (DESCRIPCION) de cada ruta, para los filtros
//
// GET /fr/sync/clientes   (header Authorization: Bearer <token movil>)
// Solo las rutas asignadas a la handheld del token (ver middleware/mobileSession.js).
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     rutas:       [{ RUTA, DESCRIPCION, ACTIVA, PERIODICIDAD }],   -> RUTA_RT
//     clientes:    [{ COD_ZON, COD_CLT, FEC_PLN, NOM_CLT, DIR_CLT,
//                     DESGLOSE, TIPO_IMPUESTO, TIPO_TARIFA, PORC_TARIFA,
//                     NIVEL_PRECIO }],                               -> CLIENTE
//     rutaOrden:   [{ RUTA, CLIENTE, DIA, ORDEN }],                 -> alFAC_RUTA_ORDEN
//     ubicaciones: [],                                              -> CLIENTE_UBICACION (sin fuente)
//     efectividades: [{ EFECT_VISITA, DESCRIPCION }]                -> EFECT_VISITA_RT (estados de visita)
//     tiposCliente:  [{ COD_CIA, COD_TIP_CL, DES_TIP_CL }]          -> erpadmin.alFAC_TIP_CLT
//     nivelesPrecio: [{ NIVEL_PRECIO, COMPANIA, LISTA, MONEDA }]    -> erpadmin.NIVEL_LISTA
//   }
// }
//
// Notas:
//  - rutaCliente.CLIENTE es el mismo código que erpadmin.cliente.COD_CLT.
//  - Se genera una fila de cliente por cada (ruta, cliente) asignado; COD_ZON es la ruta de la
//    ASIGNACIÓN (así un cliente puede estar en varias rutas).
//  - Una asignación cuyo cliente no existe en erpadmin.cliente (p. ej. "CLI01") no se envía.
//  - Las rutas salen con código y nombre ("001 - VBV"); sin nombre en rutaRt, solo el código.
//  - Las ubicaciones (GPS) vivían en CLIENTE_RT, que ya no se consulta: se envía lista vacía.
//  - CLIENTE_CIA se sincroniza aparte en GET /fr/sync/clientesCia.
//  - Los endpoints de la handheld solo leen tablas de erpadmin; CINCOH (el ERP) solo sirve para
//    llenar esas tablas, no se consulta desde aqui.
//  - NIVEL_PRECIO del cliente sale de erpadmin.cliente.NIVEL_PRECIO (nombre del nivel, tal cual).
//  - tiposCliente y nivelesPrecio salen tal cual de sus tablas (no se numera ni se transforma nada).
//  - tiposCliente y nivelesPrecio son catálogos completos (no dependen de la ruta).

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { rutaClienteModel, rutaRtModel, rutaConsecutRtModel } = require("../../models");
const { COLUMNAS_ENC, COLUMNAS_DET, FECHAS_ENC } = require("./syncEnviar");

// Columnas de erpadmin.CLIENTE_CIA (se envian tal cual a la handheld). SUBTIPODOC no va aqui:
// se traduce a codigo en getSyncClientesCia.
const CAMPOS_CLIENTE_CIA = `COD_CLT, COD_CIA, LST_PRE, IND_MON, NOM_CTO, NUM_TEL, COD_CND,
  DIA_CRE, SAL_CRE, LIM_CRE, POR_EXC_VT, POR_EXC_CS, COD_PAIS, COD_TIP_CL, DIR_EMB_DEFAULT,
  DESCUENTO, BODEGA_CONSIGNA, MULT_MON, ACEPTA_FRACCIONES, TIPO_CONTRIBUYENTE, CONTRIBUYENTE,
  DIVISION_GEOGRAFICA1, DIVISION_GEOGRAFICA2, REGIMEN_TRIB, LOCALIZACION_CONSIGNA, CODIGO,
  RAZONSOCIAL, USA_MONTO_TOPE, MONTO_TOPE, CATEGORIA_TIPO_NIT`;

// SQL Server limita los parametros por consulta (~2100): las listas largas se consultan por lotes.
const porLotes = async (lista, consulta, tamano = 500) => {
  const salida = [];
  for (let i = 0; i < lista.length; i += tamano) {
    salida.push(...(await consulta(lista.slice(i, i + tamano))));
  }
  return salida;
};

const getSyncClientes = async (req, res) => {
  try {
    // 1) Asignacion ruta-cliente-dia-orden (tabla rutaCliente) de las rutas de la handheld
    const asignaciones = await rutaClienteModel.findAll({
      where: { RUTA: req.mobile.codigosRuta },
      order: [
        ["RUTA", "ASC"],
        ["DIA", "ASC"],
        ["ORDEN", "ASC"],
      ],
      raw: true,
    });

    // 2) Datos del cliente (erpadmin.cliente), por lotes
    const codigos = [...new Set(asignaciones.map((a) => String(a.CLIENTE).trim()))];
    const erpRows = await porLotes(codigos, (lote) =>
      sequelize.query(
        `SELECT COD_CLT, NOM_CLT, DIR_CLT, FEC_PLN, DESGLOSE, TIPO_IMPUESTO, TIPO_TARIFA, PORC_TARIFA,
                NIVEL_PRECIO
           FROM COAGRO2.erpadmin.cliente
          WHERE COD_CLT IN (:lote)`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    );
    const erpDeCodigo = new Map();
    for (const e of erpRows) {
      const k = String(e.COD_CLT).trim();
      if (!erpDeCodigo.has(k)) erpDeCodigo.set(k, e);
    }

    // 3) Un cliente por (ruta, codigo); solo los que existen en erpadmin.cliente
    const vistos = new Set();
    const clientes = [];
    const rutaOrden = [];
    for (const a of asignaciones) {
      const ruta = String(a.RUTA).trim();
      const codigo = String(a.CLIENTE).trim();
      const erp = erpDeCodigo.get(codigo);
      if (!erp) continue;

      rutaOrden.push({ RUTA: a.RUTA, CLIENTE: a.CLIENTE, DIA: a.DIA, ORDEN: a.ORDEN });

      const clave = `${ruta}|${codigo}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      clientes.push({
        COD_ZON: ruta,
        COD_CLT: codigo,
        NOM_CLT: erp.NOM_CLT ?? "",
        DIR_CLT: erp.DIR_CLT ?? "",
        FEC_PLN: erp.FEC_PLN ?? null,
        DESGLOSE: erp.DESGLOSE ?? null,
        TIPO_IMPUESTO: erp.TIPO_IMPUESTO ?? null,
        TIPO_TARIFA: erp.TIPO_TARIFA ?? null,
        PORC_TARIFA: erp.PORC_TARIFA ?? null,
        NIVEL_PRECIO: erp.NIVEL_PRECIO ?? null,
      });
    }

    // 4) Rutas con su nombre (catalogo rutaRt): solo para ponerle nombre a las rutas que
    //    tienen clientes. Si una ruta no esta en el catalogo, sale solo con el codigo.
    const codigosRuta = [...new Set(clientes.map((c) => c.COD_ZON))].sort();
    const catalogo = codigosRuta.length
      ? await rutaRtModel.findAll({ where: { RUTA: codigosRuta }, raw: true })
      : [];
    const catalogoDeRuta = new Map(catalogo.map((r) => [String(r.RUTA).trim(), r]));
    const rutas = codigosRuta.map((RUTA) => {
      const r = catalogoDeRuta.get(RUTA);
      return {
        RUTA,
        DESCRIPCION: r?.DESCRIPCION ?? null,
        ACTIVA: r?.ACTIVA ?? null,
        PERIODICIDAD: r?.PERIODICIDAD ?? null,
      };
    });

    // 5) Estados de visita (erpadmin.EFECT_VISITA_RT): alimentan el combo Estado del registro de visita.
    // 6) Catalogos de tipos de cliente (erpadmin.alFAC_TIP_CLT) y niveles de precio (erpadmin.NIVEL_LISTA).
    const [efectividades, tiposCliente, nivelesPrecio] = await Promise.all([
      sequelize.query(
        `SELECT EFECT_VISITA, DESCRIPCION FROM COAGRO2.erpadmin.EFECT_VISITA_RT ORDER BY EFECT_VISITA`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COD_CIA, COD_TIP_CL, DES_TIP_CL FROM COAGRO2.erpadmin.alFAC_TIP_CLT ORDER BY COD_TIP_CL`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT NIVEL_PRECIO, COMPANIA, LISTA, MONEDA
           FROM COAGRO2.erpadmin.NIVEL_LISTA
          ORDER BY NIVEL_PRECIO, MONEDA`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    res.send({
      result: {
        rutas,
        clientes,
        rutaOrden,
        ubicaciones: [],
        efectividades,
        tiposCliente,
        nivelesPrecio,
      },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de clientes"],
    });
  }
};

//
// GET /fr/sync/articulos   (header Authorization: Bearer <token movil>)
// Solo los grupos de articulo y bodegas de las rutas de la handheld del token.
//
// Tablas:
//   - erpadmin.RUTA_ASIGNADA_RT     -> de la ruta salen GRUPO_ARTICULO y BODEGA (codigo de ruteo)
//   - erpadmin.BODEGA_ASOC_RT       -> traduce el codigo de ruteo a la bodega del ERP (BODEGA_ERP)
//   - erpadmin.ARTICULO             -> catalogo de articulos (se filtra por GRP_ART)
//   - erpadmin.ARTICULO_EXISTENCIA  -> existencia por articulo y bodega del ERP (se filtra por BODEGA_ERP)
//   - erpadmin.ARTICULO_PRECIO      -> precio por articulo, nivel de precio y moneda
//   - erpadmin.IMPUESTO             -> catalogo de impuestos (completo)
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     rutas:       [{ RUTA, GRUPO_ARTICULO, BODEGA, BODEGA_ERP }],   -> que grupo y bodega usa cada ruta
//     articulos:   [{ GRP_ART, COD_ART, COD_CIA, DES_ART, ... }],    -> ARTICULO
//     existencias: [{ ARTICULO, COMPANIA, BODEGA, EXISTENCIA }],     -> ARTICULO_EXISTENCIA (BODEGA = bodega del ERP)
//     precios:     [{ ARTICULO, COMPANIA, NIVEL_PRECIO, MONEDA, PRECIO, MARGEN_UTILIDAD, VERSION,
//                     VERSION_ARTICULO, FECHA_INICIO_VERSION_ARTICULO,
//                     FECHA_FINAL_VERSION_ARTICULO }],               -> ARTICULO_PRECIO
//     impuestos:   [{ COMPANIA, IMPUESTO, IMPUESTO1, IMPUESTO2, TIPO_TARIFA1, TIPO_TARIFA2,
//                     TIPO_IMPUESTO1, TIPO_IMPUESTO2, USA_IMPUESTO2_CANTIDAD,
//                     IMPUESTO2_CANTIDAD }],                         -> IMPUESTO
//   }
// }
//
// Notas:
//  - articulos y existencias traen los datos de TODAS las rutas de la handheld. Para la ruta
//    con la que se trabaja, la handheld filtra con su fila de `rutas`:
//      articulos   -> GRP_ART = rutas[i].GRUPO_ARTICULO
//      existencias -> BODEGA  = rutas[i].BODEGA_ERP
//    Sin ese filtro se mezclarian productos y existencias de otras rutas.
//  - La handheld une las dos listas por ARTICULO_EXISTENCIA.ARTICULO = ARTICULO.COD_ART.
//  - Solo se envian existencias y precios de articulos que vienen en `articulos`.
//  - precios trae todos los niveles; la handheld toma el del cliente:
//      ARTICULO_PRECIO.ARTICULO = ARTICULO.COD_ART AND NIVEL_PRECIO = cliente.NIVEL_PRECIO
//  - Una ruta cuyo codigo de bodega no esta en BODEGA_ASOC_RT sale con BODEGA_ERP null y sin existencias.
//  - impuestos es el catalogo completo (no depende de la ruta ni se filtra por compania); la
//    handheld lo une por ARTICULO.IMPUESTO = IMPUESTO.IMPUESTO.

const CAMPOS_ARTICULO = `GRP_ART, COD_ART, COD_CIA, UND_EMP, EMP_ALM, EMP_DET, COD_BAR, DES_ART,
  COD_FAM, COD_CLS, IMPUESTO, USA_LOTES, COSTO_LOCAL, COSTO_DOLAR, FACTOR_PRECIO, ORDEN_ART,
  FACTOR_VENTA, ARTICULO_ENVASE, TIPO, CODIGO_RETENCION, RETENCION_VENTA, RETENCION_COMPRA,
  MODELO_RETENCION, CLASIFICACION3, CLASIFICACION4, CLASIFICACION5, CLASIFICACION6,
  TIPO_DOC_IVA, NIT, CANASTA_BASICA, ES_OTRO_CARGO, TIPO_VENTA`;

const getSyncArticulos = async (req, res) => {
  try {
    // 1) Grupo de articulo y bodega de cada ruta de la handheld (ya resueltas por mobileSession)
    const rutas = req.mobile.rutas.map((r) => ({
      RUTA: String(r.RUTA).trim(),
      GRUPO_ARTICULO: String(r.GRUPO_ARTICULO).trim(),
      BODEGA: String(r.BODEGA).trim(),
      BODEGA_ERP: r.BODEGA_ERP == null ? null : String(r.BODEGA_ERP).trim(),
    }));
    const grupos = [...new Set(rutas.map((r) => r.GRUPO_ARTICULO))];
    // ARTICULO_EXISTENCIA usa la bodega del ERP, no el codigo de ruteo.
    const bodegas = [...new Set(rutas.map((r) => r.BODEGA_ERP).filter(Boolean))];

    // 2) Articulos de esos grupos
    const articulos = await sequelize.query(
      `SELECT ${CAMPOS_ARTICULO}
         FROM COAGRO2.erpadmin.ARTICULO
        WHERE GRP_ART IN (:grupos)
        ORDER BY ORDEN_ART, DES_ART`,
      { replacements: { grupos }, type: QueryTypes.SELECT }
    );

    // 3) Existencias de esas bodegas, solo de los articulos enviados
    const existenciasRows = bodegas.length
      ? await sequelize.query(
          `SELECT ARTICULO, COMPANIA, BODEGA, EXISTENCIA
             FROM COAGRO2.erpadmin.ARTICULO_EXISTENCIA
            WHERE BODEGA IN (:bodegas)
            ORDER BY BODEGA, ARTICULO`,
          { replacements: { bodegas }, type: QueryTypes.SELECT }
        )
      : [];
    const codigos = new Set(articulos.map((a) => String(a.COD_ART).trim()));
    const existencias = existenciasRows.filter((e) => codigos.has(String(e.ARTICULO).trim()));

    // 4) Precios de los articulos enviados (todos los niveles y monedas)
    const precios = await sequelize.query(
      `SELECT ARTICULO, COMPANIA, NIVEL_PRECIO, MONEDA, PRECIO, MARGEN_UTILIDAD, VERSION,
              VERSION_ARTICULO, FECHA_INICIO_VERSION_ARTICULO, FECHA_FINAL_VERSION_ARTICULO
         FROM COAGRO2.erpadmin.ARTICULO_PRECIO
        WHERE ARTICULO IN (SELECT COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE GRP_ART IN (:grupos))
        ORDER BY NIVEL_PRECIO, MONEDA, ARTICULO`,
      { replacements: { grupos }, type: QueryTypes.SELECT }
    );

    // 5) Catalogo completo de impuestos
    const impuestos = await sequelize.query(
      `SELECT COMPANIA, IMPUESTO, IMPUESTO1, IMPUESTO2, TIPO_TARIFA1, TIPO_TARIFA2,
              TIPO_IMPUESTO1, TIPO_IMPUESTO2, USA_IMPUESTO2_CANTIDAD, IMPUESTO2_CANTIDAD
         FROM COAGRO2.erpadmin.IMPUESTO
        ORDER BY IMPUESTO`,
      { type: QueryTypes.SELECT }
    );

    res.send({
      result: { rutas, articulos, existencias, precios, impuestos },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de articulos"],
    });
  }
};

//
// GET /fr/sync/lotes   (header Authorization: Bearer <token movil>)
// Existencias por lote de las bodegas de las rutas de la handheld del token.
//
// Tablas:
//   - erpadmin.RUTA_ASIGNADA_RT / BODEGA_ASOC_RT -> bodega del ERP de cada ruta (BODEGA_ERP, via mobileSession)
//   - erpadmin.ARTICULO                         -> solo articulos de los grupos (GRP_ART) de esas rutas
//   - erpadmin.ARTICULO_EXISTENCIA_LOTE         -> existencia por articulo, bodega, localizacion y lote
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     lotes: [{ COMPANIA, BODEGA, ARTICULO, LOCALIZACION, LOTE, FECHA_VENCIMIENTO, EXISTENCIA,
//               TIPO_INGRESO }]                                      -> ARTICULO_EXISTENCIA_LOTE
//   }
// }
//
// Notas:
//  - Mismo filtro que existencias en GET /fr/sync/articulos: BODEGA = BODEGA_ERP de las rutas de la
//    handheld y solo articulos de sus grupos. La handheld filtra por la ruta con la que trabaja con
//    rutas[i].BODEGA_ERP de /fr/sync/articulos, y une por ARTICULO = ARTICULO.COD_ART.
//  - Solo aplica a articulos con ARTICULO.USA_LOTES; los demas no tienen filas aqui.
//  - Llave de un lote: COMPANIA + BODEGA + ARTICULO + LOCALIZACION + LOTE.
//  - Orden: bodega, articulo y vencimiento ascendente (el que vence primero va primero).
//  - FECHA_VENCIMIENTO como texto 'YYYY-MM-DD HH:MM:SS'. Textos sin los espacios al final.
//  - Las filas salen tal cual de la tabla (no se filtra EXISTENCIA <= 0).
//  - Una handheld cuyas rutas no tienen BODEGA_ERP recibe lotes: [].
const getSyncLotes = async (req, res) => {
  try {
    const grupos = [...new Set(req.mobile.rutas.map((r) => String(r.GRUPO_ARTICULO).trim()))];
    // ARTICULO_EXISTENCIA_LOTE usa la bodega del ERP, no el codigo de ruteo.
    const bodegas = [
      ...new Set(req.mobile.rutas.map((r) => (r.BODEGA_ERP == null ? null : String(r.BODEGA_ERP).trim())).filter(Boolean)),
    ];

    const filas = bodegas.length
      ? await sequelize.query(
          `SELECT L.COMPANIA, L.BODEGA, L.ARTICULO, L.LOCALIZACION, L.LOTE,
                  CONVERT(varchar(19), L.FECHA_VENCIMIENTO, 120) AS FECHA_VENCIMIENTO,
                  L.EXISTENCIA, L.TIPO_INGRESO
             FROM COAGRO2.erpadmin.ARTICULO_EXISTENCIA_LOTE L
            WHERE L.BODEGA IN (:bodegas)
              AND L.ARTICULO IN (SELECT COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE GRP_ART IN (:grupos))
            ORDER BY L.BODEGA, L.ARTICULO, L.FECHA_VENCIMIENTO, L.LOTE`,
          { replacements: { bodegas, grupos }, type: QueryTypes.SELECT }
        )
      : [];
    const lotes = filas.map((f) =>
      Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]))
    );

    res.send({
      result: { lotes },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de lotes"],
    });
  }
};

//
// GET /fr/sync/precios?cliente=00109   (header Authorization: Bearer <token movil>)
// Precios de los articulos para el nivel de precio de un cliente (lo que puede ver en el pedido).
//
// Tablas:
//   - erpadmin.RUTA_CLIENTE     -> el cliente debe estar en alguna ruta de la handheld
//   - erpadmin.cliente          -> NIVEL_PRECIO del cliente
//   - erpadmin.ARTICULO         -> solo articulos de los grupos (GRP_ART) de las rutas de la handheld
//   - erpadmin.ARTICULO_PRECIO  -> precios de ese nivel
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     cliente:     "00109",
//     nivelPrecio: "DISTRIBUIDOR",
//     precios:     [{ ARTICULO, DES_ART, COMPANIA, NIVEL_PRECIO, MONEDA, PRECIO, MARGEN_UTILIDAD,
//                     VERSION, VERSION_ARTICULO, FECHA_INICIO_VERSION_ARTICULO,
//                     FECHA_FINAL_VERSION_ARTICULO }]                  -> ARTICULO_PRECIO
//   }
// }
//
// Notas:
//  - Un articulo sin precio en el nivel del cliente no sale (no se puede vender a ese nivel).
//  - Cliente sin NIVEL_PRECIO en erpadmin.cliente -> error, no se toma otro nivel por defecto.

const getSyncPrecios = async (req, res) => {
  try {
    const cliente = String(req.query.cliente || "").trim();
    if (!cliente) {
      return res.send({ result: {}, success: false, errors: ["El parametro cliente es obligatorio"] });
    }

    // 1) El cliente debe pertenecer a alguna ruta de la handheld
    const asignado = await rutaClienteModel.findOne({
      where: { RUTA: req.mobile.codigosRuta, CLIENTE: cliente },
      raw: true,
    });
    if (!asignado) {
      return res.send({
        result: {},
        success: false,
        errors: [`El cliente ${cliente} no esta asignado a las rutas de esta handheld`],
      });
    }

    // 2) Nivel de precio del cliente
    const [erp] = await sequelize.query(
      `SELECT TOP 1 NIVEL_PRECIO
         FROM COAGRO2.erpadmin.cliente
        WHERE COD_CLT = :cliente AND NIVEL_PRECIO IS NOT NULL`,
      { replacements: { cliente }, type: QueryTypes.SELECT }
    );
    const nivelPrecio = erp ? String(erp.NIVEL_PRECIO).trim() : "";
    if (!nivelPrecio) {
      return res.send({
        result: {},
        success: false,
        errors: [`El cliente ${cliente} no tiene nivel de precio asignado`],
      });
    }

    // 3) Precios de ese nivel, solo de los grupos de articulo de las rutas de la handheld
    const grupos = [...new Set(req.mobile.rutas.map((r) => String(r.GRUPO_ARTICULO).trim()))];
    const precios = await sequelize.query(
      `SELECT AP.ARTICULO, A.DES_ART, AP.COMPANIA, AP.NIVEL_PRECIO, AP.MONEDA, AP.PRECIO,
              AP.MARGEN_UTILIDAD, AP.VERSION, AP.VERSION_ARTICULO,
              AP.FECHA_INICIO_VERSION_ARTICULO, AP.FECHA_FINAL_VERSION_ARTICULO
         FROM COAGRO2.erpadmin.ARTICULO_PRECIO AP
         CROSS APPLY (SELECT TOP 1 DES_ART, ORDEN_ART FROM COAGRO2.erpadmin.ARTICULO
                       WHERE COD_ART = AP.ARTICULO AND GRP_ART IN (:grupos)) A
        WHERE AP.NIVEL_PRECIO = :nivelPrecio
        ORDER BY A.ORDEN_ART, A.DES_ART`,
      { replacements: { grupos, nivelPrecio }, type: QueryTypes.SELECT }
    );

    res.send({
      result: { cliente, nivelPrecio, precios },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar los precios del cliente"],
    });
  }
};

//
// GET /fr/sync/cobros   (header Authorization: Bearer <token movil>)
// Todos los documentos de los clientes de las rutas de la handheld (RUTA_CLIENTE), sin importar
// de que vendedor/ruta sea el documento: alimenta la pantalla de clientes (todo lo que debe el
// cliente). Lo del vendedor de la handheld (meta diaria) sale de /fr/sync/cobrosAgente.
//
// Tabla: erpadmin.alCXC_PEN_COB (documentos de CxC con saldo, por ruta y cliente).
// PK: (COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT). COD_ZON es la ruta del documento.
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     documentos: [{ COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT, AGENTE, NOMBRE_AGENTE, SALDO_LOCAL, ... }] -> alCXC_PEN_COB
//   }
// }
//
// Notas:
//  - COD_ZON puede ser una ruta de otro vendedor: la handheld debe unir con el cliente solo por
//    COD_CLT, no por COD_ZON + COD_CLT.
//  - AGENTE/NOMBRE_AGENTE: agente dueño de la ruta del documento (RUTA_ASIGNADA_RT); null si la ruta no
//    tiene asignacion activa.

const CAMPOS_PEN_COB = `COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT, SALDO_DOLAR, SALDO_LOCAL,
  MONTO_DOLAR, MONTO_LOCAL, FEC_DOC_FT, FEC_PRO, FEC_VEN, IND_MON, IND_ANL, TIP_CMB_DOL,
  CONDICION_PAGO, SUBTOTAL, TIP_CMB_LOC, CLASE_DOCUMENTO, INCOTERMS, FORMAS_PAGO,
  NATURALEZA_OPERACION, CUFE, CODIGOQR, INDICADOR_FACTURACION`;

// Nombre del agente de la ruta (A = RUTA_ASIGNADA_RT): A.AGENTE es el codigo de ruteo
// (AGENTE_ASOC_RT.CODIGO) y el nombre vive en AGENTE_RT, por el AGENTE del ERP.
const JOIN_NOMBRE_AGENTE = `
  LEFT JOIN COAGRO2.erpadmin.AGENTE_ASOC_RT AA ON AA.CODIGO = A.AGENTE
  LEFT JOIN COAGRO2.erpadmin.AGENTE_RT AR ON AR.AGENTE = AA.AGENTE`;

const getSyncCobros = async (req, res) => {
  try {
    // 1) Clientes asignados a las rutas de la handheld
    const asignaciones = await rutaClienteModel.findAll({
      attributes: ["CLIENTE"],
      where: { RUTA: req.mobile.codigosRuta },
      raw: true,
    });
    const codigos = [...new Set(asignaciones.map((a) => String(a.CLIENTE).trim()))];

    // 2) Todos sus documentos, de cualquier ruta/vendedor, por lotes
    const documentos = await porLotes(codigos, (lote) =>
      sequelize.query(
        `SELECT ${CAMPOS_PEN_COB.replace(/(\w+)/g, "P.$1")}, A.AGENTE, AR.NOMBRE AS NOMBRE_AGENTE
           FROM COAGRO2.erpadmin.alCXC_PEN_COB P
           LEFT JOIN COAGRO2.erpadmin.RUTA_ASIGNADA_RT A ON A.RUTA = P.COD_ZON AND A.ACTIVA = 'S'
           ${JOIN_NOMBRE_AGENTE}
          WHERE P.COD_CLT IN (:lote)`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    );
    // El orden se aplica aqui porque los lotes llegan por separado.
    const texto = (v) => String(v ?? "").trim();
    documentos.sort(
      (a, b) =>
        texto(a.COD_CLT).localeCompare(texto(b.COD_CLT)) ||
        new Date(a.FEC_VEN) - new Date(b.FEC_VEN) ||
        texto(a.NUM_DOC).localeCompare(texto(b.NUM_DOC))
    );

    res.send({
      result: { documentos },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de cobros"],
    });
  }
};

//
// GET /fr/sync/cobrosAgente   (header Authorization: Bearer <token movil>)
// Solo los documentos del vendedor de la handheld (calendario de cobros / "mi meta diaria"):
// el AGENTE que RUTA_ASIGNADA_RT le asigna a sus rutas (ver utils/handheldMobile.js). El agente
// no se pasa en la URL, sale del token; asi el vendedor 1 solo baja sus facturas. Para todo lo
// que debe cada cliente (de cualquier vendedor) esta /fr/sync/cobros.
//
// Tabla: erpadmin.alCXC_PEN_COB. No tiene columna de agente: el documento es del agente dueño
// de su ruta (COD_ZON = RUTA_ASIGNADA_RT.RUTA, ACTIVA = 'S'), sin importar en que handheld
// este esa ruta.
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     agentes:    ["10"],
//     documentos: [{ COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT, AGENTE, NOMBRE_AGENTE, SALDO_LOCAL, ... }]
//   }
// }

const getSyncCobrosAgente = async (req, res) => {
  try {
    const agentes = [
      ...new Set(req.mobile.rutas.map((r) => String(r.AGENTE ?? "").trim()).filter(Boolean)),
    ];
    if (!agentes.length) {
      return res.send({
        result: {},
        success: false,
        errors: [`La handheld ${req.mobile.handheld.HANDHELD} no tiene un agente asignado`],
      });
    }

    const documentos = await sequelize.query(
      `SELECT ${CAMPOS_PEN_COB.replace(/(\w+)/g, "P.$1")}, A.AGENTE, AR.NOMBRE AS NOMBRE_AGENTE
         FROM COAGRO2.erpadmin.alCXC_PEN_COB P
         JOIN COAGRO2.erpadmin.RUTA_ASIGNADA_RT A ON A.RUTA = P.COD_ZON AND A.ACTIVA = 'S'
         ${JOIN_NOMBRE_AGENTE}
        WHERE A.AGENTE IN (:agentes)
        ORDER BY P.COD_ZON, P.COD_CLT, P.FEC_VEN, P.NUM_DOC`,
      { replacements: { agentes }, type: QueryTypes.SELECT }
    );

    res.send({
      result: { agentes, documentos },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de cobros del agente"],
    });
  }
};

//
// GET /fr/sync/consecutivos   (header Authorization: Bearer <token movil>)
// Solo los consecutivos de las rutas de la handheld del token.
//
// Tabla: erpadmin.RUTA_CONSECUT_RT (consecutivos/NCF/DTE por ruta, relacion 1:1 con RUTA_RT).
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     consecutivos: [{ RUTA, COMPANIA, PEDIDO, RECIBO, DEVOLUCION, FACTURA, ... }] -> RUTA_CONSECUT_RT
//   }
// }
//
// Nota: una ruta de la handheld sin configuracion en RUTA_CONSECUT_RT simplemente no viene.
//
// FACTURA es el consecutivo de cotizaciones de la app (NUM_PED = FACTURA). Antes de leer, a las
// rutas de la handheld que aun no tienen serie de cotizacion (FACTURA NULL, vacio o sin prefijo
// 'COTRT') se les pone 'COTRT' + RUTA + '-001' (p. ej. 'COTRTR01-001'). El guion separa la ruta del
// contador por si la ruta termina en digitos. Prefijo por ruta porque NUM_PED no puede repetirse
// dentro de la compania. Un solo UPDATE condicionado: idempotente y seguro si dos equipos
// sincronizan a la vez; una ruta que ya tiene serie COTRT nunca se reinicia. No crea filas.

//
// GET /fr/sync/configuracion   (header Authorization: Bearer <token movil>)
// Parametros de la app para la handheld del token.
//
// Tabla: erpadmin.CONFIG_HH (una fila por HANDHELD + CONSTANTE).
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     configuracion: [{ HANDHELD, CONSTANTE, VALOR, SIMBOLO_MONEDA, ..., GPS_DISTANCIA_M }] -> CONFIG_HH
//   }
// }
//
// Notas:
//  - Las columnas GPS_* son bit: llegan como true/false (o null).
//  - Una handheld sin filas en CONFIG_HH recibe configuracion: [] (la app usa sus valores por defecto).

const getSyncConfiguracion = async (req, res) => {
  try {
    const configuracion = await sequelize.query(
      `SELECT HANDHELD, CONSTANTE, VALOR, SIMBOLO_MONEDA, NOMBRE_ARCHIVO_BITACORA,
              REGISTRO_MULTIPLE_DOCUMENTO, CANTIDAD_DECIMALES, TAMANO_LETRA_WM, DECIMALES_UNIDADES,
              LIMPIADO_FILTRO_ARTICULOS_ANDROID, INFORMACION_DESCUENTOS_VENCIDA,
              SELECCION_AUTOMATICA_CLIENTE_WM, BUSQUEDA_AGIL_CLIENTE_WM, ORDENAR_ARTICULO_CRITERIO_WM,
              ORDENAR_ARTICULO_INDICE_WM, ADVERTIR_ACTUALIZACION, PURGA_AUTOMATICA, PURGA_MANUAL,
              PURGA_CANTIDAD_DIAS, GPS_UBICACION_VISITA, GPS_UBICACION_CLIENTE,
              GPS_ACTUALIZAR_UBICACION_CLIENTE, GPS_NO_DETENER_PROCESO_WM, GPS_DISTANCIA_M
         FROM COAGRO2.erpadmin.CONFIG_HH
        WHERE HANDHELD = :handheld
        ORDER BY CONSTANTE`,
      { replacements: { handheld: req.mobile.handheld.HANDHELD }, type: QueryTypes.SELECT }
    );

    res.send({
      result: { configuracion },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de configuracion"],
    });
  }
};

const getSyncConsecutivos = async (req, res) => {
  try {
    if (req.mobile.codigosRuta.length) {
      await sequelize.query(
        `UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT
            SET FACTURA = 'COTRT' + LTRIM(RTRIM(RUTA)) + '-001'
          WHERE RUTA IN (:rutas)
            AND (FACTURA IS NULL OR LTRIM(RTRIM(FACTURA)) = '' OR FACTURA NOT LIKE 'COTRT%')`,
        { replacements: { rutas: req.mobile.codigosRuta } }
      );
    }

    const consecutivos = await rutaConsecutRtModel.findAll({
      where: { RUTA: req.mobile.codigosRuta },
      order: [["RUTA", "ASC"]],
      raw: true,
    });

    res.send({
      result: { consecutivos },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de consecutivos"],
    });
  }
};

//
// GET /fr/sync/clientesCia   (header Authorization: Bearer <token movil>)
// Solo los clientes asignados a las rutas de la handheld del token.
//
// Tablas:
//   - rutaCliente           -> que clientes van en las rutas de la handheld
//   - erpadmin.CLIENTE_CIA  -> datos del cliente por compania (lista de precios, credito, etc.)
//   - erpadmin.SUBTIPO_DOC  -> catalogo de subtipos de factura (TIPO = 'FAC')
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     clientesCia: [{ COD_CLT, COD_CIA, LST_PRE, IND_MON, NOM_CTO, ..., SUBTIPODOC }] -> CLIENTE_CIA
//     subtiposDoc: [{ COMPANIA, TIPO, SUBTIPO, DESCRIPCION }]                         -> SUBTIPO_DOC
//   }
// }
//
// Notas:
//  - Las filas salen tal cual de erpadmin.CLIENTE_CIA (ver CAMPOS_CLIENTE_CIA); un cliente
//    con varias companias trae una fila por COD_CIA. La handheld une con los clientes por COD_CLT.
//  - CLIENTE_CIA.SUBTIPODOC guarda la DESCRIPCION del subtipo ("Cont Contribuyente"), no el
//    codigo. Se traduce al SUBTIPO de SUBTIPO_DOC (TIPO 'FAC') buscando por descripcion, para
//    que la handheld lo encuentre en subtiposDoc. Sin subtipo o sin coincidencia -> null.
//  - subtiposDoc es el catalogo completo de 'FAC' (no depende de los clientes de la ruta).
//    No se filtra por compania: SUBTIPO_DOC usa COMPANIA 'COAGRO' y CLIENTE_CIA 'CINCOH'.

const getSyncClientesCia = async (req, res) => {
  try {
    // 1) Clientes asignados a las rutas de la handheld
    const asignaciones = await rutaClienteModel.findAll({
      attributes: ["CLIENTE"],
      where: { RUTA: req.mobile.codigosRuta },
      raw: true,
    });
    const codigos = [...new Set(asignaciones.map((a) => String(a.CLIENTE).trim()))];

    // 2) Sus filas de erpadmin.CLIENTE_CIA, por lotes, con SUBTIPODOC traducido a codigo
    const clientesCia = await porLotes(codigos, (lote) =>
      sequelize.query(
        `SELECT ${CAMPOS_CLIENTE_CIA}, S.SUBTIPO AS SUBTIPODOC
           FROM COAGRO2.erpadmin.CLIENTE_CIA CC
           OUTER APPLY (SELECT TOP 1 SUBTIPO FROM COAGRO2.erpadmin.SUBTIPO_DOC
                         WHERE TIPO = 'FAC'
                           AND LTRIM(RTRIM(DESCRIPCION)) = LTRIM(RTRIM(CC.SUBTIPODOC))
                         ORDER BY SUBTIPO) S
          WHERE COD_CLT IN (:lote)
          ORDER BY COD_CLT, COD_CIA`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    );

    // 3) Catalogo completo de subtipos de factura
    const subtiposDoc = await sequelize.query(
      `SELECT COMPANIA, TIPO, SUBTIPO, DESCRIPCION
         FROM COAGRO2.erpadmin.SUBTIPO_DOC
        WHERE TIPO = 'FAC'
        ORDER BY SUBTIPO`,
      { type: QueryTypes.SELECT }
    );

    res.send({
      result: { clientesCia, subtiposDoc },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de clientes por compania"],
    });
  }
};

//
// GET /fr/sync/cotizaciones   (header Authorization: Bearer <token movil>)
// Cotizaciones (TIP_DOC = 'C') de las rutas de la handheld del token, para que el vendedor las
// pueda aprobar desde la app (se aprueban con aprobaciones[] en POST /fr/sync/enviar).
//
// Tablas:
//   - erpadmin.alFAC_ENC_PED -> encabezados con TIP_DOC = 'C' y COD_ZON en las rutas del token
//   - erpadmin.alFAC_DET_PED -> sus lineas (unidas por COD_CIA + NUM_PED, TIP_DOC = 'C')
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     cotizaciones: [{ encabezado: { COD_CIA, COD_ZON, NUM_PED, ..., TIP_DOC },   -> COLUMNAS_ENC de syncEnviar.js
//                      lineas: [{ NUM_LN, COD_ART, ... }] }]                     -> COLUMNAS_DET, por NUM_LN
//   }
// }
//
// Notas:
//  - Fechas (HOR_INI, HOR_FIN, FEC_PED, FEC_DES) como texto 'YYYY-MM-DD HH:MM:SS'.
//  - Textos sin los espacios al final de las columnas char.
const getSyncCotizaciones = async (req, res) => {
  try {
    const columnasEnc = [...COLUMNAS_ENC, "TIP_DOC"].map((c) =>
      FECHAS_ENC.includes(c) ? `CONVERT(varchar(19), E.${c}, 120) AS ${c}` : `E.${c}`
    );
    const limpiar = (fila) =>
      Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));

    const encabezados = await porLotes(req.mobile.codigosRuta, (rutas) =>
      sequelize.query(
        `SELECT ${columnasEnc.join(", ")}
           FROM COAGRO2.erpadmin.alFAC_ENC_PED E
          WHERE E.TIP_DOC = 'C' AND E.COD_ZON IN (:rutas)
          ORDER BY E.COD_ZON, E.NUM_PED`,
        { replacements: { rutas }, type: QueryTypes.SELECT }
      )
    );
    // Las lineas se filtran con el mismo criterio que los encabezados (join), asi no se manda
    // la lista de NUM_PED como parametros.
    const lineas = await porLotes(req.mobile.codigosRuta, (rutas) =>
      sequelize.query(
        `SELECT D.COD_CIA AS _CIA, D.NUM_PED AS _PED, ${COLUMNAS_DET.map((c) => `D.${c}`).join(", ")}
           FROM COAGRO2.erpadmin.alFAC_DET_PED D
           JOIN COAGRO2.erpadmin.alFAC_ENC_PED E ON E.COD_CIA = D.COD_CIA AND E.NUM_PED = D.NUM_PED
          WHERE E.TIP_DOC = 'C' AND D.TIP_DOC = 'C' AND E.COD_ZON IN (:rutas)
          ORDER BY D.COD_CIA, D.NUM_PED, D.NUM_LN`,
        { replacements: { rutas }, type: QueryTypes.SELECT }
      )
    );

    const porDocumento = new Map();
    for (const { _CIA, _PED, ...linea } of lineas) {
      const llave = `${String(_CIA).trim()}|${String(_PED).trim()}`;
      if (!porDocumento.has(llave)) porDocumento.set(llave, []);
      porDocumento.get(llave).push(limpiar(linea));
    }
    const cotizaciones = encabezados.map((e) => {
      const encabezado = limpiar(e);
      return { encabezado, lineas: porDocumento.get(`${encabezado.COD_CIA}|${encabezado.NUM_PED}`) || [] };
    });

    res.send({
      result: { cotizaciones },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion de cotizaciones"],
    });
  }
};

// Busca al cliente en las rutas de la handheld. Devuelve el codigo, o null si ya respondio el error.
const clienteDeMisRutas = async (req, res) => {
  const cliente = String(req.query.cliente || "").trim();
  if (!cliente) {
    res.send({ result: {}, success: false, errors: ["El parametro cliente es obligatorio"] });
    return null;
  }
  const asignado = await rutaClienteModel.findOne({
    where: { RUTA: req.mobile.codigosRuta, CLIENTE: cliente },
    raw: true,
  });
  if (!asignado) {
    res.send({
      result: {},
      success: false,
      errors: [`El cliente ${cliente} no esta asignado a las rutas de esta handheld`],
    });
    return null;
  }
  return cliente;
};

const limpiarFila = (fila) =>
  Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
const llaveDoc = (cia, num) => `${String(cia).trim()}|${String(num).trim()}`;

// Agrupa filas { _CIA, _DOC, ...resto } por documento.
const agruparPorDocumento = (filas) => {
  const porDoc = new Map();
  for (const { _CIA, _DOC, ...fila } of filas) {
    const k = llaveDoc(_CIA, _DOC);
    if (!porDoc.has(k)) porDoc.set(k, []);
    porDoc.get(k).push(limpiarFila(fila));
  }
  return porDoc;
};

const SIN_MONTOS = { totalMercaderia: 0, descuentoVolumen: 0, subtotal: 0, iva: 0, granTotal: 0 };

// Montos sobre una expresion de monto por linea (`monto`), limitados a las lineas que cumplan `donde`.
const sqlMontos = (monto) => `
  ISNULL(SUM(${monto}), 0) AS totalMercaderia,
  ISNULL(SUM(CASE WHEN D.EST_BON = 'B' THEN ${monto} END), 0) AS descuentoVolumen,
  ISNULL(SUM(CASE WHEN D.EST_BON = 'V' THEN ${monto} END), 0) AS subtotal,
  ISNULL(SUM(CASE WHEN D.EST_BON = 'V' THEN ${monto} END), 0) * 0.13 AS iva,
  ISNULL(SUM(CASE WHEN D.EST_BON = 'V' THEN ${monto} END), 0) * 1.13 AS granTotal`;

//
// GET /fr/sync/historialPedidos?cliente=04372   (header Authorization: Bearer <token movil>)
// Historial de PEDIDOS de UN cliente (el seleccionado en la app), solo en las rutas de la handheld.
//
// Tablas:
//   - erpadmin.RUTA_CLIENTE       -> el cliente debe estar en alguna ruta de la handheld
//   - erpadmin.alFAC_ENC_HIST_PED -> encabezados con COD_CLT = cliente y COD_ZON en las rutas del token
//   - erpadmin.alFAC_DET_HIST_PED -> sus lineas (unidas por COD_CIA + NUM_PED)
//   - erpadmin.alFAC_ENC_HIST_FAC -> SOLO los NUM_FAC que salieron de cada pedido (referencia)
// Es independiente de GET /fr/sync/historialFacturas: la app no necesita llamarlo para mostrar
// pedidos. `facturas` es solo un atajo opcional para abrir la factura en ese otro endpoint.
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     cliente: "04372",
//     historial: [{
//       encabezado: { COD_CIA, NUM_PED, MON_PED, EST_PED, COD_CLT, COD_ZON, FEC_PED, DESC1, DESC2,
//                     MONT_DESC1, MONT_DESC2, ACTIVIDAD_COMERCIAL },
//       facturas: ["DTE-03-..."],                        -> NUM_FAC con ese NUM_PED (incluye anuladas)
//       lineas: [{ COD_ART, NUM_LN, EST_BON, EST_LN, facturada, cantidad, precio, MONT_DESC, PRC_DESC,
//                  totalLinea }],                        -> por NUM_LN
//       montos: { totalMercaderia, descuentoVolumen, subtotal, iva, granTotal } | null
//     }]
//   }
// }
//
// Notas:
//  - Al facturar una linea (EST_LN 'F') el ERP pasa la cantidad de CANT_PED a CANT_FAC y deja MONT_LN
//    en 0 (MONT_DESC se queda). Por eso:
//      cantidad   = CANT_PED si EST_LN = 'N', CANT_FAC si EST_LN = 'F'
//      precio     = MONT_LN / cantidad          (null si la linea esta facturada o cantidad = 0)
//      totalLinea = MONT_LN - MONT_DESC         (null si la linea esta facturada)
//    No se rellenan desde las facturas: emparejar linea de pedido con linea de factura (pedido +
//    articulo + EST_BON) solo coincide en cantidad ~81% de las veces (nov 2026), no es confiable.
//  - montos: solo sobre las lineas pendientes (EST_LN = 'N'), con (MONT_LN - MONT_DESC):
//      totalMercaderia = todas, descuentoVolumen = EST_BON 'B', subtotal = EST_BON 'V',
//      iva = subtotal * 0.13, granTotal = subtotal * 1.13.
//    null si el pedido no tiene lineas pendientes (todo facturado).
//  - Un mismo pedido repetido en dos rutas sale una sola vez (con la menor de mis rutas).
//  - Orden: fecha descendente. FEC_PED como texto 'YYYY-MM-DD HH:MM:SS'. Textos sin espacios al final.
const getSyncHistorialPedidos = async (req, res) => {
  try {
    const cliente = await clienteDeMisRutas(req, res);
    if (!cliente) return;

    const replacements = { rutas: req.mobile.codigosRuta, cliente };
    const filtro = "E.COD_ZON IN (:rutas) AND E.COD_CLT = :cliente";
    // EXISTS (no JOIN) para no duplicar lineas si el pedido esta en dos rutas.
    const deMisPedidos = `EXISTS (SELECT 1 FROM COAGRO2.erpadmin.alFAC_ENC_HIST_PED E
                                   WHERE E.COD_CIA = D.COD_CIA AND E.NUM_PED = D.NUM_PED AND ${filtro})`;
    const cantidad = "CASE WHEN D.EST_LN = 'F' THEN D.CANT_FAC ELSE D.CANT_PED END";

    const [encabezados, lineas, montos, facturas] = await Promise.all([
      sequelize.query(
        `SELECT COD_CIA, NUM_PED, MON_PED, EST_PED, COD_CLT, COD_ZON, FEC_PED, DESC1, DESC2,
                MONT_DESC1, MONT_DESC2, ACTIVIDAD_COMERCIAL
           FROM (SELECT E.COD_CIA, E.NUM_PED, E.MON_PED, E.EST_PED, E.COD_CLT, E.COD_ZON,
                        CONVERT(varchar(19), E.FEC_PED, 120) AS FEC_PED, E.FEC_PED AS _FECHA,
                        E.DESC1, E.DESC2, E.MONT_DESC1, E.MONT_DESC2, E.ACTIVIDAD_COMERCIAL,
                        ROW_NUMBER() OVER (PARTITION BY E.COD_CIA, E.NUM_PED ORDER BY E.COD_ZON) AS _N
                   FROM COAGRO2.erpadmin.alFAC_ENC_HIST_PED E
                  WHERE ${filtro}) P
          WHERE _N = 1
          ORDER BY _FECHA DESC, NUM_PED`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.COD_CIA AS _CIA, D.NUM_PED AS _DOC,
                D.COD_ART, D.NUM_LN, D.EST_BON, D.EST_LN,
                CAST(CASE WHEN D.EST_LN = 'F' THEN 1 ELSE 0 END AS bit) AS facturada,
                ${cantidad} AS cantidad,
                CASE WHEN D.EST_LN = 'F' THEN NULL ELSE D.MONT_LN / NULLIF(${cantidad}, 0) END AS precio,
                D.MONT_DESC, D.PRC_DESC,
                CASE WHEN D.EST_LN = 'F' THEN NULL ELSE D.MONT_LN - D.MONT_DESC END AS totalLinea
           FROM COAGRO2.erpadmin.alFAC_DET_HIST_PED D
          WHERE ${deMisPedidos}
          ORDER BY D.COD_CIA, D.NUM_PED, D.NUM_LN`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.COD_CIA AS _CIA, D.NUM_PED AS _DOC, ${sqlMontos("(D.MONT_LN - D.MONT_DESC)")}
           FROM COAGRO2.erpadmin.alFAC_DET_HIST_PED D
          WHERE D.EST_LN <> 'F' AND ${deMisPedidos}
          GROUP BY D.COD_CIA, D.NUM_PED`,
        { replacements, type: QueryTypes.SELECT }
      ),
      // Mismo filtro (cliente + mis rutas) que GET /fr/sync/historialFacturas, para que todo NUM_FAC
      // de aqui exista alla.
      sequelize.query(
        `SELECT DISTINCT F.COD_CIA AS _CIA, F.NUM_PED AS _DOC, F.NUM_FAC
           FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC F
          WHERE F.COD_CLT = :cliente AND F.COD_ZON IN (:rutas) AND F.NUM_PED IS NOT NULL
          ORDER BY F.NUM_FAC`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    const lineasPorPedido = agruparPorDocumento(lineas);
    const facturasPorPedido = agruparPorDocumento(facturas);
    const montosPorPedido = new Map(montos.map(({ _CIA, _DOC, ...m }) => [llaveDoc(_CIA, _DOC), m]));

    const historial = encabezados.map((e) => {
      const encabezado = limpiarFila(e);
      const k = llaveDoc(encabezado.COD_CIA, encabezado.NUM_PED);
      return {
        encabezado,
        facturas: (facturasPorPedido.get(k) || []).map((f) => f.NUM_FAC),
        lineas: lineasPorPedido.get(k) || [],
        montos: montosPorPedido.get(k) || null,
      };
    });

    res.send({
      result: { cliente, historial },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion del historial de pedidos"],
    });
  }
};

//
// GET /fr/sync/historialFacturas?cliente=04372   (header Authorization: Bearer <token movil>)
// Historial de FACTURAS de UN cliente (el seleccionado en la app), solo en las rutas de la handheld,
// con sus lineas y montos. Cada factura trae el NUM_PED que la origino.
//
// Tablas:
//   - erpadmin.RUTA_CLIENTE       -> el cliente debe estar en alguna ruta de la handheld
//   - erpadmin.alFAC_ENC_HIST_FAC -> encabezados con COD_CLT = cliente y COD_ZON en las rutas del token
//   - erpadmin.alFAC_DET_HIST_FAC -> sus lineas (unidas por COD_CIA + NUM_FAC)
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     cliente: "04372",
//     historial: [{
//       encabezado: { COD_CIA, NUM_FAC, NUM_PED, MON_FAC, COD_CLT, COD_ZON, FEC_FAC, ANULAR, NCF, COD_CND,
//                     DESC1, DESC2, MONT_DESC1, MONT_DESC2, ACTIVIDAD_COMERCIAL, ESTADO_COMPROBANTE },
//       anulada: false,
//       lineas: [{ COD_ART, NUM_LN, CANT_FAC, CANT_DEV, PRE_UNI, MONT_LN, MONT_DESC, PRC_DESC, total,
//                  EST_BON, LOTE }],                     -> por NUM_LN
//       montos: { totalMercaderia, descuentoVolumen, subtotal, iva, granTotal }
//     }]
//   }
// }
//
// Notas:
//  - En alFAC_DET_HIST_FAC, MONT_LN YA trae el descuento restado (PRE_UNI * CANT_FAC - MONT_DESC),
//    asi que total = MONT_LN (restarle MONT_DESC contaria el descuento dos veces).
//    PRC_DESC = MONT_DESC / (PRE_UNI * CANT_FAC) * 100, redondeado a 2 (la tabla no lo trae; 0 si no aplica).
//  - Montos, todos sobre MONT_LN: totalMercaderia = todas las lineas, descuentoVolumen = EST_BON 'B',
//    subtotal = EST_BON 'V', iva = subtotal * 0.13, granTotal = subtotal * 1.13 (cuadra con MON_FAC
//    salvo centavos de redondeo del ERP). Una factura sin lineas de ese tipo lleva 0.
//  - Anuladas (ANULAR = 'S') SI vienen, con anulada: true, para que la app las marque.
//  - Una misma factura puede estar dos veces en alFAC_ENC_HIST_FAC con distinto COD_ZON: sale una sola
//    vez (con la menor de mis rutas) y sus lineas no se duplican.
//  - Orden: fecha descendente. FEC_FAC como texto 'YYYY-MM-DD HH:MM:SS'. Textos sin espacios al final.
const getSyncHistorialFacturas = async (req, res) => {
  try {
    const cliente = await clienteDeMisRutas(req, res);
    if (!cliente) return;

    const replacements = { rutas: req.mobile.codigosRuta, cliente };
    const filtro = "E.COD_ZON IN (:rutas) AND E.COD_CLT = :cliente";
    // EXISTS (no JOIN) para no duplicar lineas de facturas repetidas en dos rutas.
    const deMisFacturas = `EXISTS (SELECT 1 FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC E
                                    WHERE E.COD_CIA = D.COD_CIA AND E.NUM_FAC = D.NUM_FAC AND ${filtro})`;

    const [encabezados, lineas, montos] = await Promise.all([
      sequelize.query(
        `SELECT COD_CIA, NUM_FAC, NUM_PED, MON_FAC, COD_CLT, COD_ZON, FEC_FAC, ANULAR, NCF, COD_CND,
                DESC1, DESC2, MONT_DESC1, MONT_DESC2, ACTIVIDAD_COMERCIAL, ESTADO_COMPROBANTE
           FROM (SELECT E.COD_CIA, E.NUM_FAC, E.NUM_PED, E.MON_FAC, E.COD_CLT, E.COD_ZON,
                        CONVERT(varchar(19), E.FEC_FAC, 120) AS FEC_FAC, E.FEC_FAC AS _FECHA,
                        E.ANULAR, E.NCF, E.COD_CND, E.DESC1, E.DESC2, E.MONT_DESC1, E.MONT_DESC2,
                        E.ACTIVIDAD_COMERCIAL, E.ESTADO_COMPROBANTE,
                        ROW_NUMBER() OVER (PARTITION BY E.COD_CIA, E.NUM_FAC ORDER BY E.COD_ZON) AS _N
                   FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC E
                  WHERE ${filtro}) F
          WHERE _N = 1
          ORDER BY _FECHA DESC, NUM_FAC`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.COD_CIA AS _CIA, D.NUM_FAC AS _DOC,
                D.COD_ART, D.NUM_LN, D.CANT_FAC, D.CANT_DEV, D.PRE_UNI, D.MONT_LN, D.MONT_DESC,
                ISNULL(ROUND(D.MONT_DESC * 100 / NULLIF(D.PRE_UNI * D.CANT_FAC, 0), 2), 0) AS PRC_DESC,
                D.MONT_LN AS total,
                D.EST_BON, D.LOTE
           FROM COAGRO2.erpadmin.alFAC_DET_HIST_FAC D
          WHERE ${deMisFacturas}
          ORDER BY D.COD_CIA, D.NUM_FAC, D.NUM_LN`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.COD_CIA AS _CIA, D.NUM_FAC AS _DOC, ${sqlMontos("D.MONT_LN")}
           FROM COAGRO2.erpadmin.alFAC_DET_HIST_FAC D
          WHERE ${deMisFacturas}
          GROUP BY D.COD_CIA, D.NUM_FAC`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    const lineasPorFactura = agruparPorDocumento(lineas);
    const montosPorFactura = new Map(montos.map(({ _CIA, _DOC, ...m }) => [llaveDoc(_CIA, _DOC), m]));

    const historial = encabezados.map((e) => {
      const encabezado = limpiarFila(e);
      const k = llaveDoc(encabezado.COD_CIA, encabezado.NUM_FAC);
      return {
        encabezado,
        anulada: encabezado.ANULAR === "S",
        lineas: lineasPorFactura.get(k) || [],
        montos: montosPorFactura.get(k) || SIN_MONTOS,
      };
    });

    res.send({
      result: { cliente, historial },
      success: true,
      errors: [],
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al preparar la sincronizacion del historial de facturas"],
    });
  }
};

module.exports = {
  getSyncLotes,
  getSyncHistorialPedidos,
  getSyncHistorialFacturas,
  getSyncCotizaciones,
  getSyncClientes,
  getSyncArticulos,
  getSyncCobros,
  getSyncCobrosAgente,
  getSyncConsecutivos,
  getSyncConfiguracion,
  getSyncClientesCia,
  getSyncPrecios,
};