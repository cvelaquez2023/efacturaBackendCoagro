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
//                     DESGLOSE, TIPO_IMPUESTO, TIPO_TARIFA, PORC_TARIFA }], -> CLIENTE
//     rutaOrden:   [{ RUTA, CLIENTE, DIA, ORDEN }],                 -> alFAC_RUTA_ORDEN
//     ubicaciones: [],                                              -> CLIENTE_UBICACION (sin fuente)
//     efectividades: [{ EFECT_VISITA, DESCRIPCION }]                -> EFECT_VISITA_RT (estados de visita)
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

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { rutaClienteModel, rutaRtModel } = require("../../models");

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
        `SELECT COD_CLT, NOM_CLT, DIR_CLT, FEC_PLN, DESGLOSE, TIPO_IMPUESTO, TIPO_TARIFA, PORC_TARIFA
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
    const efectividades = await sequelize.query(
      `SELECT EFECT_VISITA, DESCRIPCION FROM COAGRO2.erpadmin.EFECT_VISITA_RT ORDER BY EFECT_VISITA`,
      { type: QueryTypes.SELECT }
    );

    res.send({
      result: { rutas, clientes, rutaOrden, ubicaciones: [], efectividades },
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
//   - erpadmin.RUTA_ASIGNADA_RT     -> de la ruta salen GRUPO_ARTICULO y BODEGA
//   - erpadmin.ARTICULO             -> catalogo de articulos (se filtra por GRP_ART)
//   - erpadmin.ARTICULO_EXISTENCIA  -> existencia por articulo y bodega (se filtra por BODEGA)
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     articulos:   [{ GRP_ART, COD_ART, COD_CIA, DES_ART, ... }],    -> ARTICULO
//     existencias: [{ ARTICULO, COMPANIA, BODEGA, EXISTENCIA }],     -> ARTICULO_EXISTENCIA
//   }
// }
//
// Notas:
//  - La handheld une las dos listas por ARTICULO_EXISTENCIA.ARTICULO = ARTICULO.COD_ART.
//  - Solo se envian existencias de articulos que vienen en `articulos`.

const CAMPOS_ARTICULO = `GRP_ART, COD_ART, COD_CIA, UND_EMP, EMP_ALM, EMP_DET, COD_BAR, DES_ART,
  COD_FAM, COD_CLS, IMPUESTO, USA_LOTES, COSTO_LOCAL, COSTO_DOLAR, FACTOR_PRECIO, ORDEN_ART,
  FACTOR_VENTA, ARTICULO_ENVASE, TIPO, CODIGO_RETENCION, RETENCION_VENTA, RETENCION_COMPRA,
  MODELO_RETENCION, CLASIFICACION3, CLASIFICACION4, CLASIFICACION5, CLASIFICACION6,
  TIPO_DOC_IVA, NIT, CANASTA_BASICA, ES_OTRO_CARGO, TIPO_VENTA`;

const getSyncArticulos = async (req, res) => {
  try {
    // 1) Grupos de articulo y bodegas de las rutas de la handheld (ya resueltas por mobileSession)
    const grupos = [...new Set(req.mobile.rutas.map((r) => String(r.GRUPO_ARTICULO).trim()))];
    const bodegas = [...new Set(req.mobile.rutas.map((r) => String(r.BODEGA).trim()))];

    // 2) Articulos de esos grupos
    const articulos = await sequelize.query(
      `SELECT ${CAMPOS_ARTICULO}
         FROM COAGRO2.erpadmin.ARTICULO
        WHERE GRP_ART IN (:grupos)
        ORDER BY ORDEN_ART, DES_ART`,
      { replacements: { grupos }, type: QueryTypes.SELECT }
    );

    // 3) Existencias de esas bodegas, solo de los articulos enviados
    const existenciasRows = await sequelize.query(
      `SELECT ARTICULO, COMPANIA, BODEGA, EXISTENCIA
         FROM COAGRO2.erpadmin.ARTICULO_EXISTENCIA
        WHERE BODEGA IN (:bodegas)
        ORDER BY BODEGA, ARTICULO`,
      { replacements: { bodegas }, type: QueryTypes.SELECT }
    );
    const codigos = new Set(articulos.map((a) => String(a.COD_ART).trim()));
    const existencias = existenciasRows.filter((e) => codigos.has(String(e.ARTICULO).trim()));

    res.send({
      result: { articulos, existencias },
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
// GET /fr/sync/cobros   (header Authorization: Bearer <token movil>)
// Solo los documentos de las rutas de la handheld del token.
//
// Tabla: erpadmin.alCXC_PEN_COB (documentos de CxC con saldo, por ruta y cliente).
// PK: (COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT). COD_ZON es la ruta.
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     documentos: [{ COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT, SALDO_LOCAL, ... }] -> alCXC_PEN_COB
//   }
// }
//
// Nota: la handheld une con los clientes por COD_ZON + COD_CLT.

const CAMPOS_PEN_COB = `COD_CIA, COD_ZON, COD_TIP_DC, NUM_DOC, COD_CLT, SALDO_DOLAR, SALDO_LOCAL,
  MONTO_DOLAR, MONTO_LOCAL, FEC_DOC_FT, FEC_PRO, FEC_VEN, IND_MON, IND_ANL, TIP_CMB_DOL,
  CONDICION_PAGO, SUBTOTAL, TIP_CMB_LOC, CLASE_DOCUMENTO, INCOTERMS, FORMAS_PAGO,
  NATURALEZA_OPERACION, CUFE, CODIGOQR, INDICADOR_FACTURACION`;

const getSyncCobros = async (req, res) => {
  try {
    const documentos = await sequelize.query(
      `SELECT ${CAMPOS_PEN_COB}
         FROM COAGRO2.erpadmin.alCXC_PEN_COB
        WHERE COD_ZON IN (:rutas)
        ORDER BY COD_ZON, COD_CLT, FEC_VEN, NUM_DOC`,
      { replacements: { rutas: req.mobile.codigosRuta }, type: QueryTypes.SELECT }
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

module.exports = { getSyncClientes, getSyncArticulos, getSyncCobros };