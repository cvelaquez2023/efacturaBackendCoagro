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
//     tiposCliente:  [{ COD_CIA, COD_TIP_CL, DES_TIP_CL }]          -> CINCOH.CATEGORIA_CLIENTE
//     nivelesPrecio: [{ NIVEL_PRECIO, COMPANIA, LISTA, MONEDA }]    -> CINCOH.NIVEL_PRECIO
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
//  - tiposCliente y nivelesPrecio salen directo del ERP (schema CINCOH): erpadmin.NIVEL_LISTA esta
//    vacia. COD_CIA/COMPANIA = "CINCOH". LISTA se genera aqui: 1, 2, 3... ordenando
//    CINCOH.NIVEL_PRECIO por nombre y moneda; solo vale dentro de la misma sincronizacion.
//  - tiposCliente y nivelesPrecio son catálogos completos (no dependen de la ruta).

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { rutaClienteModel, rutaRtModel, rutaConsecutRtModel } = require("../../models");

// Compania del ERP (schema CINCOH), mismo valor que COD_CIA en las tablas erpadmin.
const CIA_ERP = "CINCOH";

// Columnas de erpadmin.CLIENTE_CIA (se envian tal cual a la handheld).
const CAMPOS_CLIENTE_CIA = `COD_CLT, COD_CIA, LST_PRE, IND_MON, NOM_CTO, NUM_TEL, COD_CND,
  DIA_CRE, SAL_CRE, LIM_CRE, POR_EXC_VT, POR_EXC_CS, COD_PAIS, COD_TIP_CL, DIR_EMB_DEFAULT,
  DESCUENTO, BODEGA_CONSIGNA, MULT_MON, ACEPTA_FRACCIONES, TIPO_CONTRIBUYENTE, CONTRIBUYENTE,
  DIVISION_GEOGRAFICA1, DIVISION_GEOGRAFICA2, REGIMEN_TRIB, LOCALIZACION_CONSIGNA, CODIGO,
  RAZONSOCIAL, USA_MONTO_TOPE, MONTO_TOPE, CATEGORIA_TIPO_NIT, SUBTIPODOC`;

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
    // 6) Catalogos de tipos de cliente (CINCOH.CATEGORIA_CLIENTE) y niveles de precio (CINCOH.NIVEL_PRECIO).
    const [efectividades, tiposCliente, niveles] = await Promise.all([
      sequelize.query(
        `SELECT EFECT_VISITA, DESCRIPCION FROM COAGRO2.erpadmin.EFECT_VISITA_RT ORDER BY EFECT_VISITA`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT '${CIA_ERP}' AS COD_CIA, CATEGORIA_CLIENTE AS COD_TIP_CL, DESCRIPCION AS DES_TIP_CL
           FROM COAGRO2.CINCOH.CATEGORIA_CLIENTE
          ORDER BY CATEGORIA_CLIENTE`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT NIVEL_PRECIO, MONEDA FROM COAGRO2.CINCOH.NIVEL_PRECIO ORDER BY NIVEL_PRECIO, MONEDA`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    // LISTA numerada por (NIVEL_PRECIO, MONEDA).
    const nivelesPrecio = niveles.map((n, i) => ({
      NIVEL_PRECIO: n.NIVEL_PRECIO,
      COMPANIA: CIA_ERP,
      LISTA: i + 1,
      MONEDA: n.MONEDA,
    }));

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
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     rutas:       [{ RUTA, GRUPO_ARTICULO, BODEGA, BODEGA_ERP }],   -> que grupo y bodega usa cada ruta
//     articulos:   [{ GRP_ART, COD_ART, COD_CIA, DES_ART, ... }],    -> ARTICULO
//     existencias: [{ ARTICULO, COMPANIA, BODEGA, EXISTENCIA }],     -> ARTICULO_EXISTENCIA (BODEGA = bodega del ERP)
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
//  - Solo se envian existencias de articulos que vienen en `articulos`.
//  - Una ruta cuyo codigo de bodega no esta en BODEGA_ASOC_RT sale con BODEGA_ERP null y sin existencias.

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

    res.send({
      result: { rutas, articulos, existencias },
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

const getSyncConsecutivos = async (req, res) => {
  try {
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
//
// Respuesta:
// {
//   success: true,
//   errors: [],
//   result: {
//     clientesCia: [{ COD_CLT, COD_CIA, LST_PRE, IND_MON, NOM_CTO, ... }] -> CLIENTE_CIA
//   }
// }
//
// Nota: las filas salen tal cual de erpadmin.CLIENTE_CIA (ver CAMPOS_CLIENTE_CIA); un cliente
// con varias companias trae una fila por COD_CIA. La handheld une con los clientes por COD_CLT.

const getSyncClientesCia = async (req, res) => {
  try {
    // 1) Clientes asignados a las rutas de la handheld
    const asignaciones = await rutaClienteModel.findAll({
      attributes: ["CLIENTE"],
      where: { RUTA: req.mobile.codigosRuta },
      raw: true,
    });
    const codigos = [...new Set(asignaciones.map((a) => String(a.CLIENTE).trim()))];

    // 2) Sus filas de erpadmin.CLIENTE_CIA, por lotes
    const clientesCia = await porLotes(codigos, (lote) =>
      sequelize.query(
        `SELECT ${CAMPOS_CLIENTE_CIA}
           FROM COAGRO2.erpadmin.CLIENTE_CIA
          WHERE COD_CLT IN (:lote)
          ORDER BY COD_CLT, COD_CIA`,
        { replacements: { lote }, type: QueryTypes.SELECT }
      )
    );

    res.send({
      result: { clientesCia },
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

module.exports = {
  getSyncClientes,
  getSyncArticulos,
  getSyncCobros,
  getSyncConsecutivos,
  getSyncClientesCia,
};