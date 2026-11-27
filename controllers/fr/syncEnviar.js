//
// POST /fr/sync/enviar   (header Authorization: Bearer <token movil>)
// La handheld sube lo que registro sin conexion, antes de volver a "Cargar datos".
//
// Tablas destino (erpadmin):
//   - CLIENTE_UBICACION  <- ubicaciones   (llave RUTA + CLIENTE; si existe se actualiza)
//   - VISITA             <- visitas       (llave CLIENTE + RUTA + INICIO)
//   - VISITA_UBICACION   <- visitas[].ubicacion (misma llave que la visita)
//   - alFAC_ENC_PED      <- pedidos[].encabezado (llave COD_CIA + COD_ZON + NUM_PED)
//   - alFAC_DET_PED      <- pedidos[].lineas     (se unen al encabezado por COD_CIA + NUM_PED)
//   - alFAC_ENC_PED/DET  <- aprobaciones  (cotizacion ya enviada: TIP_DOC 'C' -> 'F')
//   - alFAC_ENC_DEV      <- notasCredito[].encabezado (llave COD_CIA + COD_ZON + NUM_DEV)
//   - alFAC_DET_DEV      <- notasCredito[].lineas     (misma llave + COD_ART, IND_DEV, LOTE_HIST, LOTE, ART_BON)
//   - alFAC_ENC_INV      <- inventarios[].encabezado (llave COD_CIA + COD_ZON + NUM_INV)
//   - alFAC_DET_INV      <- inventarios[].lineas     (misma llave + COD_ART)
//   - alCXC_ENC_DEP      <- depositos[].encabezado (llave COD_CIA + COD_BCO + CTA_BCO + NUM_DEP)
//   - alCXC_DET_DEP      <- depositos[].lineas     (se unen al encabezado por NUM_DEP + CTA_BCO)
//   - RUTA_CONSECUT_RT   <- consecutivos  (PEDIDO, FACTURA, RECIBO, NOTACREDITO y/o INVENTARIO de la ruta, solo si avanzan)
//   - PROMOCIONALES_RT   <- promocionales (llave HANDHELD + CLIENTE + FECHA_SOLICITUD; ver procesarPromocional)
//   - cliente / CLIENTE_CIA / RUTA_CLIENTE <- cambiosCliente (datos del cliente editados en la app;
//                                             ver procesarCambioCliente y CAMPOS_CAMBIO_CLIENTE)
//
// Request (cualquier arreglo puede venir vacio u omitirse):
// {
//   ubicaciones: [{ RUTA, CLIENTE, LATITUD, LONGITUD, ALTITUD }],
//   visitas:     [{ CLIENTE, RUTA, INICIO, FIN, FECHA_PLAN, NOTAS, TIPO, RAZON,
//                   ubicacion: { LATITUD, LONGITUD, ALTITUD, TIEMPO_GPS, TIEMPO_PDA } | null }],
//   pedidos:     [{ encabezado: { COD_CIA, COD_ZON, COD_CLT, NUM_PED, ... }, lineas: [{ NUM_LN, COD_ART, ... }] }],
//   aprobaciones: [{ COD_CIA, COD_ZON, NUM_PED, FEC_PED, FEC_DES? }],   // cotizaciones que el vendedor aprobo
//   notasCredito: [{ encabezado: { COD_CIA, COD_ZON, COD_CLT, NUM_DEV, HOR_INI, HOR_FIN, FEC_DEV, ... },
//                    lineas: [{ COD_ART, IND_DEV, CNT_MAX, CNT_MIN, MON_TOT, ... }] }]   // ver procesarNotaCredito
//   inventarios: [{ encabezado: { COD_CIA, COD_ZON, COD_CLT, NUM_INV, HOR_INI, HOR_FIN, FEC_INV, NUM_ITM? },
//                   lineas: [{ COD_ART, CNT_MAX, CNT_MIN }] }]   // inventario del cliente; ver procesarInventario
//   depositos:  [{ encabezado: { COD_CIA, COD_BCO, CTA_BCO, NUM_DEP, MON_DEP, FEC_DEP, IND_MON, NOTAS?, DOC_PRO? },
//                   lineas: [{ NUM_DOC, MON_CHE?, MON_EFE?, MON_DEP?, MON_TRA?, REF? }] }],
//                   (una linea por documento; REF = texto plano de los cheques)
//   promocionales: [{ RUTA, CLIENTE, NOTAS, FECHA_REQUERIDA: 'YYYY-MM-DD[ HH:MM:SS]',
//                     FECHA_SOLICITUD: 'YYYY-MM-DD HH:MM:SS', COMPANIA? }]   // solicitud de material promocional
//   consecutivos: [{ RUTA, PEDIDO?, FACTURA?, RECIBO?, NOTACREDITO?, INVENTARIO? }]   // siguiente numero de cada documento de la ruta, ya incrementado por la app
//   cambiosCliente: [{ COD_CLT, COD_CIA?, RUTA?, TABLA?, CAMPO, VALOR, VALOR_ANTERIOR?, FECHA? }]
//                   // ultimo valor de cada dato del cliente editado en Consultar > Cliente
// }
// Fechas como texto 'YYYY-MM-DD HH:MM:SS' en hora local; se guardan tal cual (sin zona horaria).
//
// Respuesta: resultado POR REGISTRO, para que la app marque como enviado solo lo que quedo.
// {
//   success: true, errors: [],
//   result: {
//     ubicaciones:  [{ RUTA, CLIENTE, ok, error? }],
//     visitas:      [{ CLIENTE, RUTA, INICIO, ok, duplicado?, error? }],
//     pedidos:      [{ COD_ZON, NUM_PED, ok, duplicado?, conflicto?, error? }],
//     aprobaciones: [{ COD_ZON, NUM_PED, ok, duplicado?, error? }],   // siempre viene (aunque sea [])
//     notasCredito: [{ COD_ZON, NUM_DEV, ok, duplicado?, conflicto?, error? }],
//     inventarios:  [{ COD_ZON, NUM_INV, ok, duplicado?, conflicto?, error? }],
//     depositos:   [{ CTA_BCO, NUM_DEP, ok, CONSEC_DEP?, duplicado?, conflicto?, error? }],
//     promocionales: [{ CLIENTE, FECHA_SOLICITUD, ok, ID?, duplicado?, error? }],
//     consecutivos: [{ RUTA, PEDIDO, FACTURA?, ok, ignorado?, actual?, ignoradoFactura?, actualFactura?,
//                      ignoradoNotaCredito?, actualNotaCredito?, ignoradoInventario?, actualInventario?, error? }],
//     cambiosCliente: [{ COD_CLT, CAMPO, ok, error? }]   // uno por fila recibida, en el mismo orden
//   }
// }
// success: false solo si el request entero es invalido (formato); el token lo valida mobileSession (401).
//
// Notas:
//  - Se procesa en orden: ubicaciones, visitas, pedidos, aprobaciones, notasCredito, inventarios, depositos,
//    promocionales, consecutivos, cambiosCliente. Cada registro es
//    independiente: uno con error no impide guardar los demas.
//  - No duplica: una visita que ya existe responde ok con duplicado: true y NO se sobrescribe (el
//    celular puede reenviar lo mismo si se corto la respuesta).
//  - Pedido que ya existe (COD_CIA + NUM_PED en la misma ruta): si COD_CLT y HOR_INI coinciden es un
//    reenvio (ok, duplicado: true, no se sobrescribe). Si no coinciden, otro equipo uso el mismo
//    numero (p. ej. cambio de celular con pedidos sin enviar): ok: false, conflicto: true y no se
//    inserta nada, para que la app renumere y reenvie. Si existe en otra ruta tambien es conflicto.
//  - Cada pedido (encabezado + lineas) va en su propia transaccion.
//  - La ruta debe ser de la handheld del token y el cliente debe estar en RUTA_CLIENTE de esa ruta.
//  - TIP_DOC (varchar(1)): 'C' si la app manda una cotizacion; cualquier otro valor (o ninguno) se
//    guarda 'F' (pedido). COD_CIA, NUM_PED y TIP_DOC de las
//    lineas salen del encabezado. SUBTIPO_DESCRIPCION no existe en alFAC_ENC_PED: se ignora.
//  - alFAC_DET_PED no tiene COD_ZON: un NUM_PED no puede repetirse entre rutas de la misma compania.
//  - Bonificacion (lineas con ART_BON '1', siempre activa): lo regalado por articulo no puede pasar de
//    lo que dan las promociones TIPO 'B' vigentes para el pedido (proporcional, por producto, misma
//    regla que utils/precioFr.js; ver utils/bonificacionFr.js). Regalar menos esta bien. Si un articulo
//    se regala de mas se rechaza ESE documento (ok: false, error). Solo al insertar, como el descuento.
//    La linea regalada va sin montos (MON_PRC_MX, MON_PRC_MN, MON_TOT, MON_DSC, POR_DSC_AP en 0) y
//    ART_BON solo admite 0/1 (errorLineasBonificadas).
//  - Aprobacion: solo el vendedor aprueba, desde la app (las cotizaciones no vencen). Cada una va en
//    su propia transaccion: si el encabezado (COD_CIA + NUM_PED + COD_ZON) tiene TIP_DOC 'C', pasa a
//    'F' junto con todas sus lineas y FEC_PED (y FEC_DES si viene) toma lo que manda la app. Si ya es
//    'F' es un reenvio (ok, duplicado: true, no se toca). Si no existe u otro TIP_DOC: ok: false.
//    La app descarga las cotizaciones pendientes con GET /fr/sync/cotizaciones.
//  - Consecutivo: la app lleva la cuenta y manda el SIGUIENTE numero de pedido de cada ruta. El
//    backend lo compara con RUTA_CONSECUT_RT.PEDIDO (prefijo + parte numerica, /^(.*?)(\d+)$/, con
//    BigInt) y solo lo guarda si tiene el mismo prefijo y un numero MAYOR: nunca retrocede. Si es
//    menor o igual responde ok con ignorado: true y actual (el del servidor); si el prefijo es otro,
//    ok: false. Si el actual esta vacio o no termina en numero, se guarda tal cual. Asi
//    GET /fr/sync/consecutivos lo devuelve en la siguiente carga. FACTURA (consecutivo de cotizaciones)
//    sigue la misma regla contra RUTA_CONSECUT_RT.FACTURA; su resultado va en ignoradoFactura/actualFactura.
//    RECIBO (recibos de cobro; es el NUM_DEP de los depositos) igual, en ignoradoRecibo/actualRecibo.
//    NOTACREDITO (es el NUM_DEV de las notas de credito) igual, en ignoradoNotaCredito/actualNotaCredito.
//    INVENTARIO (es el NUM_INV de los inventarios del cliente) igual, en ignoradoInventario/actualInventario.
//  - Deposito: cada deposito es un RECIBO de cobro de la app; NUM_DEP es el numero del recibo
//    (RUTA_CONSECUT_RT.RECIBO de la ruta, texto: RERT_<ruta>_<correlativo>, p. ej. RERT_01_00001).
//    La boleta / transferencia van en REF.
//    CONSEC_DEP es IDENTITY: lo pone SQL Server y se devuelve en la respuesta. HandHeld sale del
//    token, no del body. NUM_DEP y CTA_BCO de las lineas salen del encabezado. Encabezado + lineas
//    van en una transaccion. Si ya existe COD_CIA + COD_BCO + CTA_BCO + NUM_DEP es un reenvio (ok,
//    duplicado: true, no se sobrescribe). Si CTA_BCO + NUM_DEP existe con otra compania o banco es
//    conflicto (alCXC_DET_DEP solo distingue por NUM_DEP + CTA_BCO). IND_MON: 'L' local, 'D' dolar.
//    COD_CIA + COD_BCO + CTA_BCO debe existir en alCXC_CTA_BCO (la app las baja de GET /fr/sync/cuentasBanco).
//  - Descuento de linea (pedidos y cotizaciones), SOLO con FR_VALIDAR_DESCUENTO=S en el .env: el
//    vendedor elige el % con un contador y no puede pasar de un tope; la app ya lo impide y el
//    servidor lo vuelve a revisar (app vieja o modificada). Tope = mismo calculo que la app, en
//    utils/topeDescuento.js: el mayor entre DESCUENTO_CLIART del cliente (TIPO 'P', vigente en FEC_PED,
//    cantidad en rango) y las promociones FR_PROMOCION del cliente o de su ruta; si ninguno aplica,
//    CLIENTE_CIA.DESCUENTO. Cantidad = CNT_MAX + CNT_MIN / FACTOR_VENTA (unidades de almacen).
//    Cada linea debe cumplir 0 <= POR_DSC_AP <= tope + 0.01 y MON_DSC = MON_TOT * POR_DSC_AP / 100
//    (+-0.01). Si una no cumple se rechaza ESE documento (ok: false, error) y nada de el se guarda; los
//    demas del envio siguen. Se revisa solo al insertar: un reenvio de un pedido ya guardado sigue
//    respondiendo duplicado. Los topes se consultan una sola vez para todas las lineas del envio.
//    Activarla cuando todas las handhelds tengan la version que limita el % y ya hayan enviado sus
//    pedidos pendientes: la app vieja dejaba escribir cualquier %, y esos pedidos quedarian
//    rechazados sin poder corregirse desde la app.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { calcularTopesDescuento } = require("../../utils/topeDescuento");
const { calcularBonificacionesPermitidas, errorBonificacion, errorLineasBonificadas, pedidoConBonificacion } = require("../../utils/bonificacionFr");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
// TIP_DOC del pedido: "F" = pedido (por defecto), "C" = cotizacion.
const TIPOS_DOC = ["F", "C"];

// Columnas que se aceptan de la app (el resto se ignora). Las de fecha van con CONVERT(..., 120).
const COLUMNAS_ENC = [
  "COD_CIA", "COD_ZON", "COD_CLT", "NUM_PED", "COD_BOD", "LST_PRE", "COD_CND", "CLASE", "COD_PAIS",
  "NUM_ITM", "ESTADO", "DESCUENTO_CASCADA", "IMPRESO", "CONSIGNACION", "DESC1", "DESC2",
  "MONT_DESC1", "MONT_DESC2", "MON_DSC", "MON_IMP_VT", "MON_IMP_CS", "MON_SIV", "MON_CIV",
  "HOR_INI", "HOR_FIN", "FEC_PED", "FEC_DES", "OBS_PED", "DIR_ENT", "NIVEL_PRECIO", "MONEDA",
  "COD_GEO1", "COD_GEO2", "ACTIVIDAD_COMERCIAL", "SUBTIPO_DOC",
];
const FECHAS_ENC = ["HOR_INI", "HOR_FIN", "FEC_PED", "FEC_DES"];

const COLUMNAS_DET = [
  "NUM_LN", "COD_ART", "CNT_MAX", "CNT_MIN", "MON_TOT", "MON_DSC", "LST_PRE", "MON_PRC_MX",
  "MON_PRC_MN", "POR_DSC_AP", "ART_BON", "PORC_IMPUESTO1", "PORC_IMPUESTO2", "PORCENTAJE_IMP1",
  "PORCENTAJE_IMP2", "PORC_EXONERACION", "MONTO_EXONERACION", "ES_CANASTA_BASICA", "ES_OTRO_CARGO",
];

// Nota de credito: encabezado y lineas de alFAC_ENC_DEV / alFAC_DET_DEV que se aceptan de la app.
// COD_CIA, COD_ZON y NUM_DEV salen del encabezado (tambien para las lineas); DOC_PRO siempre entra 'N'.
const COLUMNAS_ENC_DEV = [
  "COD_CLT", "HOR_INI", "HOR_FIN", "FEC_DEV", "OBS_DEV", "NUM_ITM", "LST_PRE", "EST_DEV", "MON_SIV",
  "MON_DSC", "POR_DSC_AP", "MON_IMP_VT", "MON_IMP_CS", "COD_BOD", "IMPRESO", "CONSIGNACION", "NUM_REF",
  "AUTOMATICA", "TIPO", "NCF_PREFIJO", "NCF", "NIVEL_PRECIO", "MONEDA", "FORMA_PAGO_DEV", "COD_PAIS",
  "COD_GEO1", "COD_GEO2", "SERIE_RESOLUCION", "CONSEC_RESOLUCION", "TIPO_ANULACION", "POR_DESC_AP2",
  "MONT_DESC2", "CLAVE_DE", "JUSTI_DEV_HACIEND", "ACTIVIDAD_COMERCIAL", "NCFMODIFICADO", "INCOTERMS",
  "FORMAS_PAGO", "NATURALEZA_OPERACION", "CUFE", "CODIGOQR", "COD_MODIFICACION", "RAZON_MODIF",
  "TIPO_INGRESO", "TIPO_PAGO", "NCF_CONTINGENCIA", "NCF_PREFIJO_CONTINGENCIA", "MASCARA_DTE",
  "CODIGO_ANULACION", "SUBTIPO",
];
const FECHAS_ENC_DEV = ["HOR_INI", "HOR_FIN", "FEC_DEV"];
const COLUMNAS_DET_DEV = [
  "COD_ART", "IND_DEV", "MON_TOT", "MON_PRC_MX", "MON_PRC_MN", "CNT_MAX", "CNT_MIN", "LST_PRE", "OBS_DEV",
  "MON_DSC", "POR_DSC_AP", "LOTE", "LOTE_HIST", "ART_BON", "TIPO_IMPUESTO1", "TIPO_TARIFA1",
  "TIPO_IMPUESTO2", "TIPO_TARIFA2", "PORC_EXONERACION", "MONTO_EXONERACION", "PORC_IMPUESTO1",
  "PORC_IMPUESTO2", "ES_OTRO_CARGO", "ES_CANASTA_BASICA", "USA_IMPUESTO2_CANTIDAD", "INDICADOR_FACTURACION",
];
// Columnas NOT NULL (INFORMATION_SCHEMA) que debe mandar la app; las numericas se validan como numero.
const OBLIGATORIAS_ENC_DEV = ["COD_BOD", "EST_DEV", "IMPRESO", "CONSIGNACION"];
const NUMERICAS_ENC_DEV = ["NUM_ITM", "LST_PRE", "MON_SIV", "MON_DSC", "POR_DSC_AP", "MON_IMP_VT", "MON_IMP_CS"];
const NUMERICAS_DET_DEV = ["MON_TOT", "MON_PRC_MX", "MON_PRC_MN", "CNT_MAX", "CNT_MIN", "LST_PRE", "MON_DSC", "POR_DSC_AP"];
// IND_DEV y ART_BON obligatorios; LOTE y LOTE_HIST son NOT NULL pero se aceptan vacios (sin lote).
const OBLIGATORIAS_DET_DEV = ["IND_DEV", "ART_BON"];
// Valores que usa la app (confirmados por el equipo movil, nov 2026). Tambien los usa la consulta web.
//  Encabezado: EST_DEV 'A' (activa; la app no anula NC), TIPO 'N/C' (tipo de documento CxC de Exactus),
//  SUBTIPO = RUTA_CONSECUT_RT.SUBTIPO_NOTA_CREDITO si es entero (si no, null), AUTOMATICA/IMPRESO/
//  CONSIGNACION 'N', POR_DSC_AP 0, NUM_REF = NUM_FAC del CCF, NCFMODIFICADO = NCF del CCF (DTE-03-...).
//  RAZON_MODIF = texto del vendedor o, si lo deja vacio, la descripcion del motivo.
const IND_DEV_NC = {
  B: "Devolucion, mercaderia en buen estado",
  M: "Devolucion, mercaderia en mal estado",
  P: "Sin devolucion fisica, solo monto",
};
// '0' = articulo vendido; '1' = bonificacion (la app hoy no la manda).
const ART_BON_NC = ["0", "1"];
// Catalogo propio de la app. '01' al precio y % de descuento del CCF; '02'/'03' monto por unidad hasta
// el precio del CCF; '99' exige RAZON_MODIF.
const MOTIVOS_NC = {
  "01": "Devolucion de mercaderia",
  "02": "Rebaja de precio",
  "03": "Correccion de precio",
  "99": "Otro motivo",
};
// Largos de las columnas de texto (INFORMATION_SCHEMA de erpadmin.alFAC_ENC_DEV / alFAC_DET_DEV).
const LARGOS_ENC_DEV = {
  NUM_DEV: 50, COD_CIA: 10, COD_ZON: 4, COD_CLT: 20, OBS_DEV: 80, EST_DEV: 1, COD_BOD: 4, IMPRESO: 1,
  CONSIGNACION: 1, NUM_REF: 50, AUTOMATICA: 1, TIPO: 50, NCF_PREFIJO: 20, NCF: 40, NIVEL_PRECIO: 12,
  MONEDA: 1, FORMA_PAGO_DEV: 1, COD_PAIS: 4, COD_GEO1: 12, COD_GEO2: 12, SERIE_RESOLUCION: 25,
  TIPO_ANULACION: 3, CLAVE_DE: 50, JUSTI_DEV_HACIEND: 2, ACTIVIDAD_COMERCIAL: 10, NCFMODIFICADO: 40,
  INCOTERMS: 4, FORMAS_PAGO: 4, NATURALEZA_OPERACION: 4, CUFE: 100, COD_MODIFICACION: 2, RAZON_MODIF: 250,
  TIPO_INGRESO: 2, TIPO_PAGO: 2, NCF_CONTINGENCIA: 40, NCF_PREFIJO_CONTINGENCIA: 20, MASCARA_DTE: 100,
  CODIGO_ANULACION: 4,
};
const LARGOS_DET_DEV = {
  COD_ART: 20, IND_DEV: 1, OBS_DEV: 80, LOTE: 15, LOTE_HIST: 15, ART_BON: 1, TIPO_IMPUESTO1: 5,
  TIPO_TARIFA1: 2, TIPO_IMPUESTO2: 5, TIPO_TARIFA2: 2, ES_OTRO_CARGO: 1, ES_CANASTA_BASICA: 1,
  USA_IMPUESTO2_CANTIDAD: 1, INDICADOR_FACTURACION: 5,
};

// Encabezado y lineas de alCXC_ENC_DEP / alCXC_DET_DEP que se aceptan de la app.
const COLUMNAS_ENC_DEP = ["MON_DEP", "FEC_DEP", "IND_MON", "NOTAS", "DOC_PRO"];
// MON_DEP (deposito del cliente) y MON_TRA (transferencia) son columnas nuevas de alCXC_DET_DEP:
// deben existir en SQL Server antes de publicar este cambio.
const COLUMNAS_DET_DEP = ["MON_CHE", "MON_EFE", "MON_DEP", "MON_TRA", "REF"];
const MONTOS_DET_DEP = ["MON_CHE", "MON_EFE", "MON_DEP", "MON_TRA"];
const MONEDAS_DEP = ["L", "D"];
// Largos de las columnas de texto (INFORMATION_SCHEMA de erpadmin.alCXC_ENC_DEP / alCXC_DET_DEP).
const LARGOS_ENC_DEP = { COD_CIA: 10, COD_BCO: 10, CTA_BCO: 20, NUM_DEP: 30, NOTAS: 80, HandHeld: 30 };
// NUM_DOC se amplio de 20 a 50: los documentos son numeros de DTE (DTE-03-M001P001-26-000000000009776 = 34).
const LARGOS_DET_DEP = { NUM_DOC: 50, REF: 80 };
// Mensaje si algun valor no cabe en su columna; null si todo cabe.
const excedeLargo = (largos, valores) => {
  for (const [columna, max] of Object.entries(largos)) {
    const v = texto(valores[columna]);
    if (v.length > max) return `${columna} "${v}" tiene ${v.length} caracteres y la columna permite ${max}`;
  }
  return null;
};
// NUM_DEP = numero de recibo de la app: letras, digitos, '_' o '-' y termina en el correlativo (max 30).
const FORMATO_NUM_DEP = /^[A-Za-z0-9_-]{0,29}\d$/;

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());

// SQL Server limita los parametros por consulta (~2100): las listas largas se consultan por lotes.
const porLotes = async (lista, consulta, tamano = 500) => {
  const salida = [];
  for (let i = 0; i < lista.length; i += tamano) {
    salida.push(...(await consulta(lista.slice(i, i + tamano))));
  }
  return salida;
};

// Mensaje claro de un error de SQL Server (NULL en columna obligatoria, truncado, etc.).
const mensajeError = (error) => {
  const sql = error.parent || error.original || error;
  return sql.message || "Error al guardar";
};

// Arma un INSERT solo con las columnas que trae el registro (las omitidas toman su default o null).
const insertar = (tabla, valores, fechas, transaction) => {
  const columnas = Object.keys(valores);
  const params = columnas.map((c) =>
    fechas.includes(c) ? `CONVERT(datetime, :${c}, 120)` : `:${c}`
  );
  return sequelize.query(
    `INSERT INTO COAGRO2.erpadmin.${tabla} (${columnas.join(", ")}) VALUES (${params.join(", ")})`,
    { replacements: valores, type: QueryTypes.INSERT, transaction }
  );
};

const tomarColumnas = (origen, columnas) => {
  const valores = {};
  for (const c of columnas) {
    if (origen[c] !== undefined && origen[c] !== null) {
      valores[c] = typeof origen[c] === "string" ? origen[c].trim() : origen[c];
    }
  }
  return valores;
};

// Valida ruta (de la handheld) y cliente (asignado a esa ruta). Devuelve un mensaje o null.
const validarRutaCliente = (contexto, ruta, cliente) => {
  if (!ruta || !cliente) return "RUTA y CLIENTE son obligatorios";
  if (!contexto.rutas.has(ruta)) return `La ruta ${ruta} no pertenece a esta handheld`;
  if (!contexto.asignaciones.has(`${ruta}|${cliente}`)) {
    return `El cliente ${cliente} no esta asignado a la ruta ${ruta}`;
  }
  return null;
};

const fechaInvalida = (registro, campos) =>
  campos.find((c) => registro[c] !== undefined && registro[c] !== null && !FECHA_REGEX.test(texto(registro[c])));

const procesarUbicacion = async (contexto, u) => {
  const RUTA = texto(u.RUTA);
  const CLIENTE = texto(u.CLIENTE);
  const salida = { RUTA, CLIENTE };
  const error = validarRutaCliente(contexto, RUTA, CLIENTE);
  if (error) return { ...salida, ok: false, error };

  try {
    await sequelize.query(
      `MERGE COAGRO2.erpadmin.CLIENTE_UBICACION AS T
       USING (SELECT :RUTA AS RUTA, :CLIENTE AS CLIENTE) AS S
          ON T.RUTA = S.RUTA AND T.CLIENTE = S.CLIENTE
        WHEN MATCHED THEN UPDATE SET LATITUD = :LATITUD, LONGITUD = :LONGITUD, ALTITUD = :ALTITUD
        WHEN NOT MATCHED THEN INSERT (RUTA, CLIENTE, LATITUD, LONGITUD, ALTITUD)
             VALUES (:RUTA, :CLIENTE, :LATITUD, :LONGITUD, :ALTITUD);`,
      {
        replacements: {
          RUTA,
          CLIENTE,
          LATITUD: u.LATITUD ?? null,
          LONGITUD: u.LONGITUD ?? null,
          ALTITUD: u.ALTITUD ?? null,
        },
      }
    );
    return { ...salida, ok: true };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

const procesarVisita = async (contexto, v) => {
  const CLIENTE = texto(v.CLIENTE);
  const RUTA = texto(v.RUTA);
  const INICIO = texto(v.INICIO);
  const salida = { CLIENTE, RUTA, INICIO };

  const error = validarRutaCliente(contexto, RUTA, CLIENTE);
  if (error) return { ...salida, ok: false, error };
  for (const c of ["INICIO", "FIN", "FECHA_PLAN", "RAZON"]) {
    if (!texto(v[c])) return { ...salida, ok: false, error: `El campo ${c} es obligatorio` };
  }
  const ubicacion = v.ubicacion || null;
  const malVisita = fechaInvalida(v, ["INICIO", "FIN", "FECHA_PLAN"]);
  const malUbicacion = ubicacion && fechaInvalida(ubicacion, ["TIEMPO_GPS", "TIEMPO_PDA"]);
  if (malVisita || malUbicacion) {
    return { ...salida, ok: false, error: `${malVisita || malUbicacion} debe tener formato YYYY-MM-DD HH:MM:SS` };
  }

  try {
    let duplicado = false;
    await sequelize.transaction(async (transaction) => {
      const llave = { CLIENTE, RUTA, INICIO };
      const where = `CLIENTE = :CLIENTE AND RUTA = :RUTA AND INICIO = CONVERT(datetime, :INICIO, 120)`;

      const [existe] = await sequelize.query(
        `SELECT 1 AS X FROM COAGRO2.erpadmin.VISITA WHERE ${where}`,
        { replacements: llave, type: QueryTypes.SELECT, transaction }
      );
      if (existe) {
        duplicado = true;
      } else {
        await insertar(
          "VISITA",
          { ...llave, ...tomarColumnas(v, ["FIN", "FECHA_PLAN", "NOTAS", "TIPO", "RAZON"]) },
          ["INICIO", "FIN", "FECHA_PLAN"],
          transaction
        );
      }

      // El GPS se agrega si viene y la visita aun no lo tiene (tambien en un reenvio).
      if (ubicacion) {
        const [conGps] = await sequelize.query(
          `SELECT 1 AS X FROM COAGRO2.erpadmin.VISITA_UBICACION WHERE ${where}`,
          { replacements: llave, type: QueryTypes.SELECT, transaction }
        );
        if (!conGps) {
          await insertar(
            "VISITA_UBICACION",
            { ...llave, ...tomarColumnas(ubicacion, ["LATITUD", "LONGITUD", "ALTITUD", "TIEMPO_GPS", "TIEMPO_PDA"]) },
            ["INICIO", "TIEMPO_GPS", "TIEMPO_PDA"],
            transaction
          );
        }
      }
    });
    return { ...salida, ok: true, duplicado };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

// Validacion del % de descuento por linea (ver cabecera). Solo con FR_VALIDAR_DESCUENTO=S.
const validarDescuentoActiva = () => texto(process.env.FR_VALIDAR_DESCUENTO).toUpperCase() === "S";
const TOLERANCIA_DESCUENTO = 0.01;
const formatoPorc = (v) => String(Math.round(Number(v) * 10000) / 10000);

// Topes de todas las lineas del envio en una sola pasada: Map pedido -> [{ tope, cantidad }] (por linea).
const topesDePedidos = async (pedidos) => {
  const filas = [];
  const dueno = [];
  for (const p of pedidos) {
    const enc = (p && p.encabezado) || {};
    const lineas = Array.isArray(p && p.lineas) ? p.lineas : [];
    for (const l of lineas) {
      filas.push({
        COD_CIA: enc.COD_CIA, COD_ZON: enc.COD_ZON, COD_CLT: enc.COD_CLT, FEC_PED: enc.FEC_PED,
        COD_ART: l && l.COD_ART, CNT_MAX: l && l.CNT_MAX, CNT_MIN: l && l.CNT_MIN, MON_PRC_MX: l && l.MON_PRC_MX,
      });
      dueno.push(p);
    }
  }
  const topes = await calcularTopesDescuento(filas);
  const porPedido = new Map();
  topes.forEach((t, i) => {
    if (!porPedido.has(dueno[i])) porPedido.set(dueno[i], []);
    porPedido.get(dueno[i]).push(t);
  });
  return porPedido;
};

// Mensaje de la primera linea que no cumple; null si todas cumplen (o la validacion esta apagada).
const errorDescuento = (contexto, p, NUM_PED) => {
  if (!contexto.topesDescuento) return null;
  const topes = contexto.topesDescuento.get(p) || [];
  for (const [i, l] of p.lineas.entries()) {
    const codArt = texto(l.COD_ART);
    const tope = topes[i] ? topes[i].tope : 0;
    const vacio = l.POR_DSC_AP === undefined || l.POR_DSC_AP === null || l.POR_DSC_AP === "";
    const porc = vacio ? 0 : Number(l.POR_DSC_AP);
    if (!Number.isFinite(porc) || porc < 0) {
      return `Pedido ${NUM_PED}: el descuento de ${codArt} (${texto(l.POR_DSC_AP)}) no es un porcentaje valido`;
    }
    if (porc > tope + TOLERANCIA_DESCUENTO) {
      return `Pedido ${NUM_PED}: el descuento de ${codArt} (${formatoPorc(porc)}%) supera el permitido (${formatoPorc(tope)}%)`;
    }
    const total = Number(l.MON_TOT) || 0;
    const monto = Number(l.MON_DSC) || 0;
    const esperado = (total * porc) / 100;
    if (Math.abs(monto - esperado) > TOLERANCIA_DESCUENTO) {
      return (
        `Pedido ${NUM_PED}: el monto de descuento de ${codArt} (${monto}) no corresponde al ` +
        `${formatoPorc(porc)}% de ${total} (${Math.round(esperado * 100) / 100})`
      );
    }
  }
  return null;
};

const procesarPedido = async (contexto, p) => {
  const enc = (p && p.encabezado) || {};
  const lineas = Array.isArray(p && p.lineas) ? p.lineas : [];
  const COD_ZON = texto(enc.COD_ZON);
  const NUM_PED = texto(enc.NUM_PED);
  const COD_CIA = texto(enc.COD_CIA);
  const TIP_DOC = TIPOS_DOC.includes(texto(enc.TIP_DOC)) ? texto(enc.TIP_DOC) : "F";
  const salida = { COD_ZON, NUM_PED };

  if (!COD_CIA || !NUM_PED) return { ...salida, ok: false, error: "COD_CIA y NUM_PED son obligatorios" };
  const error = validarRutaCliente(contexto, COD_ZON, texto(enc.COD_CLT));
  if (error) return { ...salida, ok: false, error };
  if (!lineas.length) return { ...salida, ok: false, error: "El pedido no trae lineas" };
  if (enc.NUM_ITM !== undefined && Number(enc.NUM_ITM) !== lineas.length) {
    return { ...salida, ok: false, error: `NUM_ITM (${enc.NUM_ITM}) no coincide con las ${lineas.length} lineas` };
  }
  const mal = fechaInvalida(enc, FECHAS_ENC);
  if (mal) return { ...salida, ok: false, error: `${mal} debe tener formato YYYY-MM-DD HH:MM:SS` };
  const sinArticulo = lineas.find((l) => !contexto.articulos.has(texto(l.COD_ART)));
  if (sinArticulo) return { ...salida, ok: false, error: `Articulo ${texto(sinArticulo.COD_ART)} no existe` };

  try {
    let duplicado = false;
    let conflicto = null;
    let rechazo = null;
    await sequelize.transaction(async (transaction) => {
      // Las lineas se unen solo por COD_CIA + NUM_PED: el numero no puede estar en otra ruta.
      const [existe] = await sequelize.query(
        `SELECT TOP 1 COD_ZON, COD_CLT, CONVERT(varchar(19), HOR_INI, 120) AS HOR_INI
           FROM COAGRO2.erpadmin.alFAC_ENC_PED WITH (UPDLOCK)
          WHERE COD_CIA = :COD_CIA AND NUM_PED = :NUM_PED`,
        { replacements: { COD_CIA, NUM_PED }, type: QueryTypes.SELECT, transaction }
      );
      if (existe && texto(existe.COD_ZON) !== COD_ZON) {
        conflicto = `El pedido ${NUM_PED} ya existe en la ruta ${texto(existe.COD_ZON)}`;
        return;
      }

      if (existe) {
        // Mismo cliente y misma hora de inicio = reenvio; si no, otro documento uso el mismo numero.
        if (texto(existe.COD_CLT) === texto(enc.COD_CLT) && texto(existe.HOR_INI) === texto(enc.HOR_INI)) {
          duplicado = true;
        } else {
          conflicto =
            `El número ${NUM_PED} ya lo usa otro documento ` +
            `(cliente ${texto(existe.COD_CLT)}, ${texto(existe.HOR_INI)})`;
        }
      } else {
        // Solo al insertar: un reenvio de lo ya guardado sigue siendo duplicado.
        rechazo =
          errorDescuento(contexto, p, NUM_PED) ||
          errorLineasBonificadas(p, NUM_PED) ||
          errorBonificacion(contexto.bonificaciones && contexto.bonificaciones.get(p), NUM_PED);
        if (rechazo) return;
        await insertar(
          "alFAC_ENC_PED",
          { ...tomarColumnas(enc, COLUMNAS_ENC), COD_CIA, COD_ZON, NUM_PED, TIP_DOC },
          FECHAS_ENC,
          transaction
        );
        for (const l of lineas) {
          await insertar(
            "alFAC_DET_PED",
            { ...tomarColumnas(l, COLUMNAS_DET), COD_CIA, NUM_PED, TIP_DOC },
            [],
            transaction
          );
        }
      }
    });
    if (conflicto) return { ...salida, ok: false, conflicto: true, error: conflicto };
    if (rechazo) return { ...salida, ok: false, error: rechazo };
    return { ...salida, ok: true, duplicado };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

// Aprobar una cotizacion ya enviada = convertirla en pedido (TIP_DOC 'C' -> 'F' en encabezado y lineas).
const procesarAprobacion = async (contexto, a) => {
  const COD_CIA = texto(a.COD_CIA);
  const COD_ZON = texto(a.COD_ZON);
  const NUM_PED = texto(a.NUM_PED);
  const salida = { COD_ZON, NUM_PED };

  if (!COD_CIA || !COD_ZON || !NUM_PED) {
    return { ...salida, ok: false, error: "COD_CIA, COD_ZON y NUM_PED son obligatorios" };
  }
  if (!contexto.rutas.has(COD_ZON)) return { ...salida, ok: false, error: `La ruta ${COD_ZON} no pertenece a esta handheld` };
  if (!texto(a.FEC_PED)) return { ...salida, ok: false, error: "El campo FEC_PED es obligatorio" };
  const mal = fechaInvalida(a, ["FEC_PED", "FEC_DES"]);
  if (mal) return { ...salida, ok: false, error: `${mal} debe tener formato YYYY-MM-DD HH:MM:SS` };

  const FEC_PED = texto(a.FEC_PED);
  const FEC_DES = texto(a.FEC_DES);
  const llave = { COD_CIA, COD_ZON, NUM_PED };

  try {
    return await sequelize.transaction(async (transaction) => {
      const [enc] = await sequelize.query(
        `SELECT TIP_DOC FROM COAGRO2.erpadmin.alFAC_ENC_PED WITH (UPDLOCK)
          WHERE COD_CIA = :COD_CIA AND NUM_PED = :NUM_PED AND COD_ZON = :COD_ZON`,
        { replacements: llave, type: QueryTypes.SELECT, transaction }
      );
      if (!enc) return { ...salida, ok: false, error: `La cotización ${NUM_PED} no existe en la ruta ${COD_ZON}` };

      const tipo = texto(enc.TIP_DOC);
      // Ya es pedido: reenvio de la misma aprobacion.
      if (tipo === "F") return { ...salida, ok: true, duplicado: true };
      if (tipo !== "C") {
        return { ...salida, ok: false, error: `El documento ${NUM_PED} tiene TIP_DOC '${tipo}': solo se aprueban cotizaciones ('C')` };
      }

      await sequelize.query(
        `UPDATE COAGRO2.erpadmin.alFAC_ENC_PED
            SET TIP_DOC = 'F', FEC_PED = CONVERT(datetime, :FEC_PED, 120)
                ${FEC_DES ? ", FEC_DES = CONVERT(datetime, :FEC_DES, 120)" : ""}
          WHERE COD_CIA = :COD_CIA AND NUM_PED = :NUM_PED AND COD_ZON = :COD_ZON AND TIP_DOC = 'C'`,
        { replacements: { ...llave, FEC_PED, FEC_DES }, transaction }
      );
      await sequelize.query(
        `UPDATE COAGRO2.erpadmin.alFAC_DET_PED SET TIP_DOC = 'F' WHERE COD_CIA = :COD_CIA AND NUM_PED = :NUM_PED`,
        { replacements: { COD_CIA, NUM_PED }, transaction }
      );
      return { ...salida, ok: true };
    });
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

const esMonto = (v) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));

// Validacion de la nota de credito contra el CCF que afecta (NUM_REF = NUM_FAC del historial).
// Mismos criterios que la app, mas los que esta no podia ver:
//  - NUM_REF debe empezar con 'DTE-03-' (credito fiscal). Hacienda solo emite CCF a contribuyentes, asi
//    que no se mira CLIENTE_CIA.TIPO_CONTRIBUYENTE (CargaAlMovil lo deja 'F' fijo) ni CONTRIBUYENTE (NIT).
//  - El CCF debe estar en erpadmin.alFAC_ENC_HIST_FAC de la compania, ser DEL MISMO CLIENTE y no estar
//    anulado (ANULAR 'S'). No se exige la ruta: el historial repite la factura en varias rutas.
//  - Por articulo y tipo (ART_BON '0' = vendido -> EST_BON 'V'; '1' = bonificado -> 'B'):
//      cantidad de la nota <= SUM(CANT_FAC) - SUM(CANT_DEV) del CCF - lo de otras NC del mismo CCF aun
//      no procesadas (DOC_PRO 'N' o NULL), con cantidad = CNT_MAX + CNT_MIN / FACTOR_VENTA (si > 1;
//      si no, solo CNT_MAX), igual que utils/topeDescuento.js. Cuenta toda linea (B, M y P): una rebaja
//      de precio tambien "consume" las unidades del CCF, como lo hace la app.
//  - Cada linea: cantidad > 0 y MON_PRC_MX <= PRE_UNI del CCF (+0.01).
//  - Notas POR MONTO (COD_MODIFICACION 02 rebaja, 03 correccion, 99 otro; cambio pedido por la app,
//    nov 2026): no llevan articulos del CCF sino UNA linea base COD_ART '0000' (IND_DEV 'P', ART_BON '0',
//    CNT_MAX 1, CNT_MIN 0). No se revisan articulo, cantidad ni precio; en su lugar:
//      MON_SIV + MON_IMP_VT + MON_IMP_CS de esta nota <= MON_FAC del CCF (incluye IVA; solo lineas
//      vendidas, sin bonificaciones) - el mismo total de las OTRAS notas de ese CCF (cualquier handheld,
//      motivo y DOC_PRO), salvo anuladas (TIPO_ANULACION o CODIGO_ANULACION con valor).
//    Las notas 01 (devolucion) siguen con la regla por articulo y cantidad.
// Devuelve el mensaje del primer problema, o null.
const PREFIJO_CCF = "DTE-03-";
const MOTIVOS_POR_MONTO = ["02", "03", "99"];
// Linea base de las notas por monto. No existe en ARTICULO (ni erpadmin ni CINCOH): se acepta solo aqui.
const ARTICULO_BASE_NC = "0000";
const TOLERANCIA_MONTO_NC = 0.01;
const totalNc = (e) => (Number(e.MON_SIV) || 0) + (Number(e.MON_IMP_VT) || 0) + (Number(e.MON_IMP_CS) || 0);
const centavos = (n) => (Math.round(n * 100) / 100).toFixed(2);
const TOLERANCIA_NC = 0.0001;
const TOLERANCIA_PRECIO_NC = 0.01;
const redondeo = (n) => Math.round(n * 10000) / 10000;
const cantidadNc = (contexto, l) => {
  const factor = contexto.factorVenta.get(texto(l.COD_ART)) || 0;
  return (Number(l.CNT_MAX) || 0) + (factor > 1 ? (Number(l.CNT_MIN) || 0) / factor : 0);
};
const tipoLinea = (artBon) => (texto(artBon) === "1" ? "B" : "V");

const validarContraCcf = async (contexto, { COD_CIA, COD_CLT, NUM_REF, porMonto, total }, filas, transaction) => {
  const opciones = { replacements: { COD_CIA, NUM_REF }, type: QueryTypes.SELECT, transaction };
  const encabezados = await sequelize.query(
    `SELECT LTRIM(RTRIM(COD_CLT)) AS COD_CLT, ISNULL(ANULAR, 'N') AS ANULAR, CAST(MON_FAC AS float) AS MON_FAC
       FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC
      WHERE COD_CIA = :COD_CIA AND NUM_FAC = :NUM_REF`,
    opciones
  );
  if (!encabezados.length) return `El CCF ${NUM_REF} no existe en el historial de facturas (compania ${COD_CIA})`;
  const delCliente = encabezados.filter((e) => e.COD_CLT === COD_CLT);
  if (!delCliente.length) return `El CCF ${NUM_REF} es del cliente ${encabezados[0].COD_CLT}, no de ${COD_CLT}`;
  if (delCliente.every((e) => texto(e.ANULAR) === "S")) return `El CCF ${NUM_REF} esta anulado`;

  if (porMonto) {
    const montoCcf = Number(delCliente.find((e) => texto(e.ANULAR) !== "S").MON_FAC) || 0;
    const [otras] = await sequelize.query(
      `SELECT CAST(ISNULL(SUM(ISNULL(MON_SIV, 0) + ISNULL(MON_IMP_VT, 0) + ISNULL(MON_IMP_CS, 0)), 0) AS float) AS TOTAL
         FROM COAGRO2.erpadmin.alFAC_ENC_DEV
        WHERE COD_CIA = :COD_CIA AND NUM_REF = :NUM_REF
          AND ISNULL(TIPO_ANULACION, '') = '' AND ISNULL(CODIGO_ANULACION, '') = ''`,
      opciones
    );
    const disponible = montoCcf - otras.TOTAL;
    if (total > disponible + TOLERANCIA_MONTO_NC) {
      return (
        `El monto de la nota (${centavos(total)}) supera lo disponible del CCF ${NUM_REF}: ` +
        `${centavos(Math.max(disponible, 0))} (total CCF ${centavos(montoCcf)}, otras notas ${centavos(otras.TOTAL)})`
      );
    }
    return null;
  }

  // En serie: las consultas comparten la transaccion (una sola conexion).
  const detalle = await sequelize.query(
    `SELECT LTRIM(RTRIM(COD_ART)) AS COD_ART, ISNULL(EST_BON, 'V') AS EST_BON,
            CAST(SUM(ISNULL(CANT_FAC, 0)) AS float) AS CANT_FAC, CAST(SUM(ISNULL(CANT_DEV, 0)) AS float) AS CANT_DEV,
            CAST(MAX(PRE_UNI) AS float) AS PRE_UNI
       FROM COAGRO2.erpadmin.alFAC_DET_HIST_FAC
      WHERE COD_CIA = :COD_CIA AND NUM_FAC = :NUM_REF
      GROUP BY LTRIM(RTRIM(COD_ART)), ISNULL(EST_BON, 'V')`,
    opciones
  );
  const pendientes = await sequelize.query(
    `SELECT LTRIM(RTRIM(D.COD_ART)) AS COD_ART, D.ART_BON, CAST(D.CNT_MAX AS float) AS CNT_MAX,
            CAST(D.CNT_MIN AS float) AS CNT_MIN
       FROM COAGRO2.erpadmin.alFAC_DET_DEV D
       JOIN COAGRO2.erpadmin.alFAC_ENC_DEV E
         ON E.COD_CIA = D.COD_CIA AND E.COD_ZON = D.COD_ZON AND E.NUM_DEV = D.NUM_DEV
      WHERE E.COD_CIA = :COD_CIA AND E.NUM_REF = :NUM_REF AND ISNULL(E.DOC_PRO, 'N') = 'N'`,
    opciones
  );

  const delCcf = new Map(detalle.map((d) => [`${d.COD_ART}|${texto(d.EST_BON)}`, d]));
  const enOtrasNc = new Map();
  for (const p of pendientes) {
    const k = `${p.COD_ART}|${tipoLinea(p.ART_BON)}`;
    enOtrasNc.set(k, (enOtrasNc.get(k) || 0) + cantidadNc(contexto, p));
  }

  const enEstaNc = new Map();
  for (const f of filas) {
    const cantidad = cantidadNc(contexto, f);
    const tipo = tipoLinea(f.ART_BON);
    const que = tipo === "B" ? "bonificado" : "vendido";
    if (!(cantidad > 0)) return `La cantidad del articulo ${f.COD_ART} debe ser mayor que 0`;
    const linea = delCcf.get(`${f.COD_ART}|${tipo}`);
    if (!linea) return `El articulo ${f.COD_ART} (${que}) no esta en el CCF ${NUM_REF}`;
    if (Number(f.MON_PRC_MX) > linea.PRE_UNI + TOLERANCIA_PRECIO_NC) {
      return `El precio del articulo ${f.COD_ART} (${Number(f.MON_PRC_MX)}) supera el del CCF (${linea.PRE_UNI})`;
    }
    const k = `${f.COD_ART}|${tipo}`;
    enEstaNc.set(k, (enEstaNc.get(k) || 0) + cantidad);
  }

  for (const [k, cantidad] of enEstaNc) {
    const linea = delCcf.get(k);
    const otras = enOtrasNc.get(k) || 0;
    const disponible = linea.CANT_FAC - linea.CANT_DEV - otras;
    if (cantidad > disponible + TOLERANCIA_NC) {
      return (
        `El articulo ${linea.COD_ART} supera lo disponible en el CCF ${NUM_REF}: pide ${redondeo(cantidad)}, ` +
        `disponible ${redondeo(Math.max(disponible, 0))} (facturado ${redondeo(linea.CANT_FAC)}, devuelto ` +
        `${redondeo(linea.CANT_DEV)}, en otras notas sin procesar ${redondeo(otras)})`
      );
    }
  }
  return null;
};

// Nota de credito (devolucion sobre un credito fiscal) creada en la app. Solo la crea la movil; la
// web solo la consulta (GET /fr/notaCredito). Llave COD_CIA + COD_ZON + NUM_DEV (PK de alFAC_ENC_DEV);
// NUM_DEV es el consecutivo RUTA_CONSECUT_RT.NOTACREDITO de la ruta (la app lo avanza con consecutivos).
//  - Ruta de la handheld y cliente asignado a la ruta; articulos existentes en ARTICULO.
//  - Si ya existe con el mismo COD_CLT y HOR_INI es un reenvio (ok, duplicado: true, no se sobrescribe);
//    si no coincide, otro documento uso el numero: ok: false, conflicto: true (la app renumera).
//  - IND_DEV debe ser B/M/P, ART_BON 0/1 y COD_MODIFICACION (si viene) 01/02/03/99; con 99, RAZON_MODIF
//    es obligatorio (ver IND_DEV_NC, ART_BON_NC, MOTIVOS_NC).
//  - Lineas: la PK es COD_ART + IND_DEV + LOTE_HIST + LOTE + ART_BON; no pueden repetirse en la nota.
//    LOTE y LOTE_HIST se guardan '' si no vienen (columnas NOT NULL).
//  - Contra el CCF que se afecta (validarContraCcf, solo al insertar; un reenvio sigue siendo duplicado).
//  - Encabezado + lineas en una transaccion. DOC_PRO siempre entra 'N' (pendiente de procesar).
const procesarNotaCredito = async (contexto, n) => {
  const enc = (n && n.encabezado) || {};
  const lineas = Array.isArray(n && n.lineas) ? n.lineas : [];
  const COD_CIA = texto(enc.COD_CIA);
  const COD_ZON = texto(enc.COD_ZON);
  const NUM_DEV = texto(enc.NUM_DEV);
  const COD_CLT = texto(enc.COD_CLT);
  const salida = { COD_ZON, NUM_DEV };
  const falla = (error) => ({ ...salida, ok: false, error });

  if (!COD_CIA || !NUM_DEV) return falla("COD_CIA y NUM_DEV son obligatorios");
  const error = validarRutaCliente(contexto, COD_ZON, COD_CLT);
  if (error) return falla(error);
  if (!lineas.length) return falla("La nota de credito no trae lineas");

  for (const c of FECHAS_ENC_DEV) if (!texto(enc[c])) return falla(`El campo ${c} es obligatorio`);
  const mal = fechaInvalida(enc, FECHAS_ENC_DEV);
  if (mal) return falla(`${mal} debe tener formato YYYY-MM-DD HH:MM:SS`);
  for (const c of OBLIGATORIAS_ENC_DEV) if (!texto(enc[c])) return falla(`El campo ${c} es obligatorio`);
  for (const c of NUMERICAS_ENC_DEV) if (!esMonto(enc[c])) return falla(`${c} debe ser un numero`);
  if (Number(enc.NUM_ITM) !== lineas.length) {
    return falla(`NUM_ITM (${enc.NUM_ITM}) no coincide con las ${lineas.length} lineas`);
  }
  const largoEnc = excedeLargo(LARGOS_ENC_DEV, { ...enc, COD_CIA, COD_ZON, NUM_DEV });
  if (largoEnc) return falla(largoEnc);
  const motivo = texto(enc.COD_MODIFICACION);
  if (motivo && !MOTIVOS_NC[motivo]) {
    return falla(`COD_MODIFICACION '${motivo}' no es valido (${Object.keys(MOTIVOS_NC).join(", ")})`);
  }
  if (motivo === "99" && !texto(enc.RAZON_MODIF)) return falla("RAZON_MODIF es obligatorio con el motivo 99 (otro)");
  const NUM_REF = texto(enc.NUM_REF);
  if (!NUM_REF) return falla("NUM_REF (numero del CCF que se afecta) es obligatorio");
  if (!NUM_REF.startsWith(PREFIJO_CCF)) {
    return falla(`La nota de credito solo se aplica a un credito fiscal (${PREFIJO_CCF}...); ${NUM_REF} no lo es`);
  }
  if (texto(enc.NCFMODIFICADO) && texto(enc.NCFMODIFICADO) !== NUM_REF) {
    return falla(`NCFMODIFICADO (${texto(enc.NCFMODIFICADO)}) debe ser igual a NUM_REF (${NUM_REF})`);
  }
  // 02/03/99: una sola linea base '0000' (ver validarContraCcf).
  const porMonto = MOTIVOS_POR_MONTO.includes(motivo);
  const total = totalNc(enc);
  if (porMonto) {
    if (lineas.length !== 1) return falla(`Las notas ${MOTIVOS_POR_MONTO.join(", ")} llevan una sola linea (${ARTICULO_BASE_NC})`);
    const base = lineas[0] || {};
    if (texto(base.IND_DEV) !== "P" || texto(base.ART_BON) !== "0" || Number(base.CNT_MAX) !== 1 || Number(base.CNT_MIN) !== 0) {
      return falla(`La linea ${ARTICULO_BASE_NC} debe ir con IND_DEV 'P', ART_BON '0', CNT_MAX 1 y CNT_MIN 0`);
    }
    if (!(total > 0)) return falla("El monto de la nota (MON_SIV + MON_IMP_VT + MON_IMP_CS) debe ser mayor que 0");
  }

  const llaves = new Set();
  const filas = [];
  for (const l of lineas) {
    const linea = l || {};
    const COD_ART = texto(linea.COD_ART);
    if (!COD_ART) return falla("Cada linea debe traer COD_ART");
    if (COD_ART === ARTICULO_BASE_NC) {
      if (!porMonto) {
        return falla(`El articulo ${ARTICULO_BASE_NC} solo se usa en notas por monto (${MOTIVOS_POR_MONTO.join(", ")})`);
      }
    } else if (porMonto) {
      return falla(`Las notas ${MOTIVOS_POR_MONTO.join(", ")} llevan solo la linea ${ARTICULO_BASE_NC}, no articulos (${COD_ART})`);
    } else if (!contexto.articulos.has(COD_ART)) {
      return falla(`Articulo ${COD_ART} no existe`);
    }
    for (const c of OBLIGATORIAS_DET_DEV) {
      if (!texto(linea[c])) return falla(`El campo ${c} del articulo ${COD_ART} es obligatorio`);
    }
    for (const c of NUMERICAS_DET_DEV) {
      if (!esMonto(linea[c])) return falla(`${c} del articulo ${COD_ART} debe ser un numero`);
    }
    if (!IND_DEV_NC[texto(linea.IND_DEV)]) {
      return falla(`IND_DEV del articulo ${COD_ART} debe ser ${Object.keys(IND_DEV_NC).join(", ")}`);
    }
    if (!ART_BON_NC.includes(texto(linea.ART_BON))) {
      return falla(`ART_BON del articulo ${COD_ART} debe ser ${ART_BON_NC.join(" o ")}`);
    }
    const fila = { ...tomarColumnas(linea, COLUMNAS_DET_DEV), COD_ART, LOTE: texto(linea.LOTE), LOTE_HIST: texto(linea.LOTE_HIST) };
    const largoDet = excedeLargo(LARGOS_DET_DEV, fila);
    if (largoDet) return falla(largoDet);
    const llave = [COD_ART, fila.IND_DEV, fila.LOTE_HIST, fila.LOTE, fila.ART_BON].join("|");
    if (llaves.has(llave)) {
      return falla(`El articulo ${COD_ART} viene repetido (mismo IND_DEV, lote y ART_BON)`);
    }
    llaves.add(llave);
    filas.push(fila);
  }

  try {
    let duplicado = false;
    let conflicto = null;
    let rechazo = null;
    await sequelize.transaction(async (transaction) => {
      const [existe] = await sequelize.query(
        `SELECT TOP 1 COD_CLT, CONVERT(varchar(19), HOR_INI, 120) AS HOR_INI
           FROM COAGRO2.erpadmin.alFAC_ENC_DEV WITH (UPDLOCK, HOLDLOCK)
          WHERE COD_CIA = :COD_CIA AND COD_ZON = :COD_ZON AND NUM_DEV = :NUM_DEV`,
        { replacements: { COD_CIA, COD_ZON, NUM_DEV }, type: QueryTypes.SELECT, transaction }
      );
      if (existe) {
        if (texto(existe.COD_CLT) === COD_CLT && texto(existe.HOR_INI) === texto(enc.HOR_INI)) {
          duplicado = true;
        } else {
          conflicto =
            `El número ${NUM_DEV} ya lo usa otra nota de credito ` +
            `(cliente ${texto(existe.COD_CLT)}, ${texto(existe.HOR_INI)})`;
        }
        return;
      }

      rechazo = await validarContraCcf(contexto, { COD_CIA, COD_CLT, NUM_REF, porMonto, total }, filas, transaction);
      if (rechazo) return;
      await insertar(
        "alFAC_ENC_DEV",
        { ...tomarColumnas(enc, COLUMNAS_ENC_DEV), COD_CIA, COD_ZON, NUM_DEV, COD_CLT, DOC_PRO: "N" },
        FECHAS_ENC_DEV,
        transaction
      );
      for (const fila of filas) {
        await insertar("alFAC_DET_DEV", { ...fila, COD_CIA, COD_ZON, NUM_DEV }, [], transaction);
      }
    });
    if (conflicto) return { ...salida, ok: false, conflicto: true, error: conflicto };
    if (rechazo) return falla(rechazo);
    return { ...salida, ok: true, duplicado };
  } catch (e) {
    console.log(e);
    return falla(mensajeError(e));
  }
};

// Inventario del cliente: el vendedor cuenta en la app cuanto tiene el cliente de cada articulo (cajas
// en CNT_MAX y unidades sueltas en CNT_MIN). Solo lo crea la movil; la web solo consulta
// (GET /fr/inventarioCliente) y la app baja su historial con GET /fr/sync/inventarios.
// Tablas erpadmin.alFAC_ENC_INV / alFAC_DET_INV (vacias y sin procesos del ERP al crearse, nov 2026).
//  - NUM_INV es el consecutivo RUTA_CONSECUT_RT.INVENTARIO de la ruta (la app lo avanza con consecutivos).
//  - Llave: COD_CIA + COD_ZON + NUM_INV. La PK del encabezado incluye COD_CLT, pero la del detalle NO
//    (COD_ART + COD_ZON + NUM_INV + COD_CIA): un NUM_INV no puede repetirse en la ruta aunque sea de otro
//    cliente, y un articulo va una sola vez por inventario.
//  - Ruta de la handheld y cliente asignado a la ruta; articulos existentes en ARTICULO.
//  - HOR_INI, HOR_FIN y FEC_INV obligatorios ('YYYY-MM-DD HH:MM:SS'; en BD aceptan NULL, pero HOR_INI
//    se usa para reconocer el reenvio). NUM_ITM = numero de lineas.
//  - CNT_MAX y CNT_MIN obligatorios, >= 0 (contar 0 es valido: el cliente no tiene ese articulo).
//  - Si ya existe con el mismo COD_CLT y HOR_INI es un reenvio (ok, duplicado: true, no se sobrescribe);
//    si no, otro documento uso el numero: ok: false, conflicto: true (la app renumera).
//  - Encabezado + lineas en una transaccion. DOC_PRO entra 'N' en encabezado y lineas.
const FECHAS_ENC_INV = ["HOR_INI", "HOR_FIN", "FEC_INV"];
const LARGOS_ENC_INV = { COD_CIA: 10, NUM_INV: 20, COD_ZON: 4, COD_CLT: 20 };
const procesarInventario = async (contexto, i) => {
  const enc = (i && i.encabezado) || {};
  const lineas = Array.isArray(i && i.lineas) ? i.lineas : [];
  const COD_CIA = texto(enc.COD_CIA);
  const COD_ZON = texto(enc.COD_ZON);
  const NUM_INV = texto(enc.NUM_INV);
  const COD_CLT = texto(enc.COD_CLT);
  const salida = { COD_ZON, NUM_INV };
  const falla = (error) => ({ ...salida, ok: false, error });

  if (!COD_CIA || !NUM_INV) return falla("COD_CIA y NUM_INV son obligatorios");
  const error = validarRutaCliente(contexto, COD_ZON, COD_CLT);
  if (error) return falla(error);
  if (!lineas.length) return falla("El inventario no trae lineas");
  for (const c of FECHAS_ENC_INV) if (!texto(enc[c])) return falla(`El campo ${c} es obligatorio`);
  const mal = fechaInvalida(enc, FECHAS_ENC_INV);
  if (mal) return falla(`${mal} debe tener formato YYYY-MM-DD HH:MM:SS`);
  if (enc.NUM_ITM !== undefined && enc.NUM_ITM !== null && Number(enc.NUM_ITM) !== lineas.length) {
    return falla(`NUM_ITM (${enc.NUM_ITM}) no coincide con las ${lineas.length} lineas`);
  }
  const largo = excedeLargo(LARGOS_ENC_INV, { COD_CIA, NUM_INV, COD_ZON, COD_CLT });
  if (largo) return falla(largo);

  const filas = [];
  const vistos = new Set();
  for (const l of lineas) {
    const linea = l || {};
    const COD_ART = texto(linea.COD_ART);
    if (!COD_ART) return falla("Cada linea debe traer COD_ART");
    if (!contexto.articulos.has(COD_ART)) return falla(`Articulo ${COD_ART} no existe`);
    if (vistos.has(COD_ART)) return falla(`El articulo ${COD_ART} viene repetido en el inventario`);
    vistos.add(COD_ART);
    for (const c of ["CNT_MAX", "CNT_MIN"]) {
      if (!esMonto(linea[c]) || Number(linea[c]) < 0) {
        return falla(`${c} del articulo ${COD_ART} debe ser un numero mayor o igual a 0`);
      }
    }
    filas.push({ COD_ART, CNT_MAX: Number(linea.CNT_MAX), CNT_MIN: Number(linea.CNT_MIN) });
  }

  try {
    let duplicado = false;
    let conflicto = null;
    await sequelize.transaction(async (transaction) => {
      const [existe] = await sequelize.query(
        `SELECT TOP 1 COD_CLT, CONVERT(varchar(19), HOR_INI, 120) AS HOR_INI
           FROM COAGRO2.erpadmin.alFAC_ENC_INV WITH (UPDLOCK, HOLDLOCK)
          WHERE COD_CIA = :COD_CIA AND COD_ZON = :COD_ZON AND NUM_INV = :NUM_INV`,
        { replacements: { COD_CIA, COD_ZON, NUM_INV }, type: QueryTypes.SELECT, transaction }
      );
      if (existe) {
        if (texto(existe.COD_CLT) === COD_CLT && texto(existe.HOR_INI) === texto(enc.HOR_INI)) {
          duplicado = true;
        } else {
          conflicto =
            `El número ${NUM_INV} ya lo usa otro inventario ` +
            `(cliente ${texto(existe.COD_CLT)}, ${texto(existe.HOR_INI)})`;
        }
        return;
      }

      await insertar(
        "alFAC_ENC_INV",
        {
          COD_CIA, NUM_INV, COD_ZON, COD_CLT,
          HOR_INI: texto(enc.HOR_INI), HOR_FIN: texto(enc.HOR_FIN), FEC_INV: texto(enc.FEC_INV),
          NUM_ITM: lineas.length, DOC_PRO: "N",
        },
        FECHAS_ENC_INV,
        transaction
      );
      for (const f of filas) {
        await insertar("alFAC_DET_INV", { ...f, COD_ZON, NUM_INV, COD_CIA, DOC_PRO: "N" }, [], transaction);
      }
    });
    if (conflicto) return { ...salida, ok: false, conflicto: true, error: conflicto };
    return { ...salida, ok: true, duplicado };
  } catch (e) {
    console.log(e);
    return falla(mensajeError(e));
  }
};

const procesarDeposito = async (contexto, d) => {
  const enc = (d && d.encabezado) || {};
  const lineas = Array.isArray(d && d.lineas) ? d.lineas : [];
  const COD_CIA = texto(enc.COD_CIA);
  const COD_BCO = texto(enc.COD_BCO);
  const CTA_BCO = texto(enc.CTA_BCO);
  const NUM_DEP = texto(enc.NUM_DEP);
  const salida = { CTA_BCO, NUM_DEP };

  for (const [c, v] of Object.entries({ COD_CIA, COD_BCO, CTA_BCO, NUM_DEP })) {
    if (!v) return { ...salida, ok: false, error: `El campo ${c} es obligatorio` };
  }
  if (!contexto.cuentasBanco.has(`${COD_CIA}|${COD_BCO}|${CTA_BCO}`)) {
    return { ...salida, ok: false, error: `La cuenta ${CTA_BCO} del banco ${COD_BCO} (compania ${COD_CIA}) no existe` };
  }
  if (!FORMATO_NUM_DEP.test(NUM_DEP)) {
    return { ...salida, ok: false, error: "NUM_DEP debe ser el numero de recibo (p. ej. RERT_01_00001)" };
  }
  if (!esMonto(enc.MON_DEP)) return { ...salida, ok: false, error: "MON_DEP debe ser un monto" };
  if (!texto(enc.FEC_DEP)) return { ...salida, ok: false, error: "El campo FEC_DEP es obligatorio" };
  if (fechaInvalida(enc, ["FEC_DEP"])) return { ...salida, ok: false, error: "FEC_DEP debe tener formato YYYY-MM-DD HH:MM:SS" };
  if (!MONEDAS_DEP.includes(texto(enc.IND_MON))) {
    return { ...salida, ok: false, error: `IND_MON debe ser ${MONEDAS_DEP.join(" o ")}` };
  }
  // Largos de las columnas: se avisa cual no cabe (SQL Server solo dice "would be truncated").
  const largoEnc = excedeLargo(LARGOS_ENC_DEP, { COD_CIA, COD_BCO, CTA_BCO, NUM_DEP, NOTAS: enc.NOTAS, HandHeld: contexto.handheld });
  if (largoEnc) return { ...salida, ok: false, error: largoEnc };
  const docs = new Set();
  for (const l of lineas) {
    const NUM_DOC = texto(l && l.NUM_DOC);
    if (!NUM_DOC) return { ...salida, ok: false, error: "Cada linea debe traer NUM_DOC" };
    if (docs.has(NUM_DOC)) return { ...salida, ok: false, error: `El documento ${NUM_DOC} viene repetido en el deposito` };
    docs.add(NUM_DOC);
    const largoDet = excedeLargo(LARGOS_DET_DEP, { NUM_DOC, REF: l.REF });
    if (largoDet) return { ...salida, ok: false, error: largoDet };
    const malMonto = MONTOS_DET_DEP.find((c) => l[c] !== undefined && l[c] !== null && !esMonto(l[c]));
    if (malMonto) return { ...salida, ok: false, error: `${malMonto} del documento ${NUM_DOC} debe ser un monto` };
  }

  try {
    let duplicado = false;
    let conflicto = null;
    let CONSEC_DEP = null;
    await sequelize.transaction(async (transaction) => {
      // HOLDLOCK: la PK incluye CONSEC_DEP (IDENTITY), asi que la BD no impide el duplicado.
      const [existe] = await sequelize.query(
        `SELECT TOP 1 COD_CIA, COD_BCO, CONSEC_DEP FROM COAGRO2.erpadmin.alCXC_ENC_DEP WITH (UPDLOCK, HOLDLOCK)
          WHERE CTA_BCO = :CTA_BCO AND NUM_DEP = :NUM_DEP`,
        { replacements: { CTA_BCO, NUM_DEP }, type: QueryTypes.SELECT, transaction }
      );
      if (existe) {
        if (texto(existe.COD_CIA) === COD_CIA && texto(existe.COD_BCO) === COD_BCO) {
          duplicado = true;
          CONSEC_DEP = existe.CONSEC_DEP;
        } else {
          conflicto =
            `El deposito ${NUM_DEP} de la cuenta ${CTA_BCO} ya existe ` +
            `(compania ${texto(existe.COD_CIA)}, banco ${texto(existe.COD_BCO)})`;
        }
        return;
      }

      const valores = {
        ...tomarColumnas(enc, COLUMNAS_ENC_DEP),
        COD_CIA, COD_BCO, CTA_BCO, NUM_DEP,
        HandHeld: contexto.handheld,
      };
      const columnas = Object.keys(valores);
      const params = columnas.map((c) => (c === "FEC_DEP" ? `CONVERT(datetime, :${c}, 120)` : `:${c}`));
      const [insertado] = await sequelize.query(
        `INSERT INTO COAGRO2.erpadmin.alCXC_ENC_DEP (${columnas.join(", ")})
         OUTPUT INSERTED.CONSEC_DEP
         VALUES (${params.join(", ")})`,
        { replacements: valores, type: QueryTypes.SELECT, transaction }
      );
      CONSEC_DEP = insertado && insertado.CONSEC_DEP;

      for (const l of lineas) {
        await insertar(
          "alCXC_DET_DEP",
          { ...tomarColumnas(l, COLUMNAS_DET_DEP), NUM_DOC: texto(l.NUM_DOC), NUM_DEP, CTA_BCO },
          [],
          transaction
        );
      }
    });
    if (conflicto) return { ...salida, ok: false, conflicto: true, error: conflicto };
    return { ...salida, ok: true, CONSEC_DEP, duplicado };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

// Separa prefijo y parte numerica igual que la app ('RP10001' -> RP, 10001n). null si no termina en numero.
const partirConsecutivo = (valor) => {
  const m = /^(.*?)(\d+)$/.exec(valor);
  return m ? { prefijo: m[1], numero: BigInt(m[2]) } : null;
};

// Nunca retrocede: solo avanza con el mismo prefijo y un numero mayor al del servidor.
// Devuelve { error } si el prefijo no coincide, { ignorado: true } si no avanza, o {} si se guarda.
const compararConsecutivo = (RUTA, recibidoTexto, actual) => {
  const delServidor = partirConsecutivo(actual);
  if (!delServidor) return {};
  const recibido = partirConsecutivo(recibidoTexto);
  if (!recibido || recibido.prefijo !== delServidor.prefijo) {
    return { error: `El consecutivo ${recibidoTexto} no tiene el formato del actual de la ruta ${RUTA} (${actual})` };
  }
  return recibido.numero <= delServidor.numero ? { ignorado: true } : {};
};

// PEDIDO (pedidos) y FACTURA (cotizaciones), cada uno opcional pero al menos uno. Misma regla para
// ambos. Si alguno tiene error no se guarda ninguno. La respuesta de PEDIDO conserva su forma
// (ignorado, actual); la de FACTURA va en ignoradoFactura, actualFactura.
const procesarConsecutivo = async (contexto, c) => {
  const RUTA = texto(c.RUTA);
  const PEDIDO = texto(c.PEDIDO);
  const FACTURA = texto(c.FACTURA);
  const RECIBO = texto(c.RECIBO);
  const NOTACREDITO = texto(c.NOTACREDITO);
  const INVENTARIO = texto(c.INVENTARIO);
  const salida = { RUTA, PEDIDO };
  if (FACTURA) salida.FACTURA = FACTURA;
  if (RECIBO) salida.RECIBO = RECIBO;
  if (NOTACREDITO) salida.NOTACREDITO = NOTACREDITO;
  if (INVENTARIO) salida.INVENTARIO = INVENTARIO;
  if (!RUTA || (!PEDIDO && !FACTURA && !RECIBO && !NOTACREDITO && !INVENTARIO)) {
    return { ...salida, ok: false, error: "RUTA y PEDIDO, FACTURA, RECIBO, NOTACREDITO o INVENTARIO son obligatorios" };
  }
  if (!contexto.rutas.has(RUTA)) return { ...salida, ok: false, error: `La ruta ${RUTA} no pertenece a esta handheld` };

  try {
    return await sequelize.transaction(async (transaction) => {
      const [fila] = await sequelize.query(
        `SELECT PEDIDO, FACTURA, RECIBO, NOTACREDITO, INVENTARIO FROM COAGRO2.erpadmin.RUTA_CONSECUT_RT WITH (UPDLOCK) WHERE RUTA = :RUTA`,
        { replacements: { RUTA }, type: QueryTypes.SELECT, transaction }
      );
      if (!fila) return { ...salida, ok: false, error: `La ruta ${RUTA} no tiene consecutivos configurados` };

      const respuesta = { ...salida, ok: true };
      const sets = [];
      const campos = [
        { columna: "PEDIDO", valor: PEDIDO, ignorado: "ignorado", actual: "actual" },
        { columna: "FACTURA", valor: FACTURA, ignorado: "ignoradoFactura", actual: "actualFactura" },
        { columna: "RECIBO", valor: RECIBO, ignorado: "ignoradoRecibo", actual: "actualRecibo" },
        { columna: "NOTACREDITO", valor: NOTACREDITO, ignorado: "ignoradoNotaCredito", actual: "actualNotaCredito" },
        { columna: "INVENTARIO", valor: INVENTARIO, ignorado: "ignoradoInventario", actual: "actualInventario" },
      ];
      for (const campo of campos) {
        if (!campo.valor) continue;
        const actual = texto(fila[campo.columna]);
        const r = compararConsecutivo(RUTA, campo.valor, actual);
        if (r.error) return { ...salida, ok: false, error: r.error };
        if (r.ignorado) {
          respuesta[campo.ignorado] = true;
          respuesta[campo.actual] = actual;
        } else {
          sets.push(`${campo.columna} = :${campo.columna}`);
        }
      }

      if (sets.length) {
        await sequelize.query(
          `UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT SET ${sets.join(", ")} WHERE RUTA = :RUTA`,
          { replacements: { RUTA, PEDIDO, FACTURA, RECIBO, NOTACREDITO, INVENTARIO }, transaction }
        );
      }
      return respuesta;
    });
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

// Solicitud de material promocional (texto libre). Llave HANDHELD + CLIENTE + FECHA_SOLICITUD (como
// VISITA con INICIO): si ya existe es un reenvio (ok, duplicado: true, no se sobrescribe). La app
// fija FECHA_SOLICITUD al crear la solicitud y no la cambia al reenviar. AGENTE sale de la ruta
// (RUTA_ASIGNADA_RT de la handheld) y NOM_CLT de erpadmin.cliente al consultar: los que manda la
// app se ignoran. DOC_PRO siempre entra 'N'.
const LARGOS_PROMOCIONAL = { NOTAS: 500, COMPANIA: 10 };
const procesarPromocional = async (contexto, p) => {
  const RUTA = texto(p.RUTA);
  const CLIENTE = texto(p.CLIENTE);
  const FECHA_SOLICITUD = texto(p.FECHA_SOLICITUD);
  const salida = { CLIENTE, FECHA_SOLICITUD };
  const error = validarRutaCliente(contexto, RUTA, CLIENTE);
  if (error) return { ...salida, ok: false, error };
  if (!texto(p.NOTAS)) return { ...salida, ok: false, error: "NOTAS es obligatorio" };
  // La app la manda a medianoche ('YYYY-MM-DD 00:00:00'); la columna es date: se toma solo el dia.
  const requerida = texto(p.FECHA_REQUERIDA);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requerida) && !FECHA_REGEX.test(requerida)) {
    return { ...salida, ok: false, error: "FECHA_REQUERIDA debe tener formato YYYY-MM-DD o YYYY-MM-DD HH:MM:SS" };
  }
  if (!FECHA_REGEX.test(FECHA_SOLICITUD)) {
    return { ...salida, ok: false, error: "FECHA_SOLICITUD debe tener formato YYYY-MM-DD HH:MM:SS" };
  }
  const largo = excedeLargo(LARGOS_PROMOCIONAL, p);
  if (largo) return { ...salida, ok: false, error: largo };

  try {
    const replacements = {
      HANDHELD: contexto.handheld,
      RUTA,
      CLIENTE,
      AGENTE: contexto.agenteDeRuta.get(RUTA) || null,
      COMPANIA: texto(p.COMPANIA) || null,
      NOTAS: texto(p.NOTAS),
      FECHA_REQUERIDA: requerida.slice(0, 10),
      FECHA_SOLICITUD,
    };
    // Un solo statement; si dos envios llegan a la vez, el UNIQUE de la llave evita el doble.
    const llave = `HANDHELD = :HANDHELD AND CLIENTE = :CLIENTE AND FECHA_SOLICITUD = CONVERT(datetime, :FECHA_SOLICITUD, 120)`;
    const [fila] = await sequelize.query(
      `IF EXISTS (SELECT 1 FROM COAGRO2.erpadmin.PROMOCIONALES_RT WHERE ${llave})
         SELECT ID, CAST(1 AS bit) AS DUPLICADO FROM COAGRO2.erpadmin.PROMOCIONALES_RT WHERE ${llave}
       ELSE
         INSERT INTO COAGRO2.erpadmin.PROMOCIONALES_RT
                (HANDHELD, RUTA, CLIENTE, AGENTE, COMPANIA, NOTAS, FECHA_REQUERIDA, FECHA_SOLICITUD)
         OUTPUT INSERTED.ID, CAST(0 AS bit) AS DUPLICADO
         VALUES (:HANDHELD, :RUTA, :CLIENTE, :AGENTE, :COMPANIA, :NOTAS,
                 CONVERT(date, :FECHA_REQUERIDA, 23), CONVERT(datetime, :FECHA_SOLICITUD, 120))`,
      { replacements, type: QueryTypes.SELECT }
    );
    return { ...salida, ok: true, ID: fila.ID, duplicado: !!fila.DUPLICADO };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

// Cambios a datos del cliente hechos en la app (Consultar > Cliente). Cada fila trae el ULTIMO valor
// de un dato; se escribe en la MISMA tabla y columna de la que GET /fr/sync/clientes lo lee, asi la
// siguiente carga ya trae el valor nuevo. Es un UPDATE al mismo valor: reenviar es seguro.
//  - COD_CLT es el codigo de la handheld = erpadmin.cliente.COD_CLT = RUTA_CLIENTE.CLIENTE (igual que
//    en /fr/sync/clientes). Debe estar asignado a alguna ruta de la handheld.
//  - El backend decide la tabla segun CAMPO (TABLA de la app es informativa). La columna sale SIEMPRE
//    de CAMPOS_CAMBIO_CLIENTE, nunca del texto recibido. Cualquier otro CAMPO: "Campo no editable".
//  - Campos de erpadmin.cliente: se actualizan TODAS las filas del cliente (una por COD_ZON).
//    Incluye ALIAS (nombre comercial, max 80; "" -> NULL).
//  - Campos de CLIENTE_CIA: la fila de COD_CIA si viene; si no, la misma que manda /fr/sync/clientes
//    (CINCOH primero). Si el cliente no tiene fila en CLIENTE_CIA: ok false (no se crea).
//  - NIVEL_PRECIO debe existir en NIVEL_LISTA. NO se toca LST_PRE: en NIVEL_LISTA todos los niveles
//    tienen LISTA 1, mientras los clientes usan LST_PRE 8; copiarla cambiaria sus precios.
//  - DIAS_VISITA (RUTA_CLIENTE): un cliente solo tiene UN dia por ruta (misma regla que el CRUD
//    /fr/rutaCliente), asi que VALOR debe traer un solo dia. Si es el mismo que ya tiene, no se toca
//    (conserva su ORDEN); si es otro, se mueve a ese dia al final: ORDEN = MAX(ORDEN) + 1 de la ruta y dia.
//  - Divisiones geograficas (CLIENTE_CIA, reforma 2024, catalogos nativos de Softland en erpadmin;
//    ver GET /fr/sync/municipios): DIVISION_GEOGRAFICA1 = departamento, DIVISION_GEOGRAFICA2 =
//    municipio y DIVISION_GEOGRAFICA3 (columna division_geografica3) = distrito. "" -> NULL (se
//    permite vaciar). Si traen valor (validarDivision), en el pais de las divisiones:
//      1 debe existir en erpadmin.DIVISION_GEOGRAFICA1;
//      2 debe existir en erpadmin.DIVISION_GEOGRAFICA2 para el departamento;
//      3 debe existir en erpadmin.DIVISION_GEOGRAFICA3 para el departamento y el municipio.
//    Departamento / municipio de referencia: el ultimo que vino en el envio para ese cliente; si no
//    vino, el guardado en CLIENTE_CIA. La app debe mandar los tres juntos al cambiar uno de arriba.
//    Pais: CLIENTE_CIA.COD_PAIS si tiene departamentos; si no (en este ERP COD_PAIS suele ser un
//    codigo de vendedor), FR_PAIS_DIVISION o 'ESA'.
//  - Textos que no caben en la columna: ok false (no se recortan). VALOR_ANTERIOR y FECHA no se usan.
const textoLibre = (largo, vacio) => ({ tipo: "texto", largo, vacio });
const numero = (min, max, entero = false) => ({ tipo: "numero", min, max, entero });
const CAMPOS_CAMBIO_CLIENTE = {
  // erpadmin.cliente
  NOM_CLT: { tabla: "cliente", columna: "NOM_CLT", ...textoLibre(150, "requerido") },
  DIR_CLT: { tabla: "cliente", columna: "DIR_CLT", ...textoLibre(null, "vacio") },
  // Nombre comercial (varchar(80), admite null). "" -> NULL.
  ALIAS: { tabla: "cliente", columna: "ALIAS", ...textoLibre(80, "null") },
  NIVEL_PRECIO: {
    tabla: "cliente", columna: "NIVEL_PRECIO", tipo: "catalogo", largo: 150, nombre: "nivel de precio",
    existe: `SELECT 1 AS OK FROM COAGRO2.erpadmin.NIVEL_LISTA WHERE NIVEL_PRECIO = :valor`,
  },
  // erpadmin.CLIENTE_CIA
  NOM_CTO: { tabla: "cia", columna: "NOM_CTO", ...textoLibre(30, "vacio") },
  NUM_TEL: { tabla: "cia", columna: "NUM_TEL", ...textoLibre(50, "vacio") },
  codActividad: { tabla: "cia", columna: "codActividad", ...textoLibre(50, "null") },
  desActividad: { tabla: "cia", columna: "desActividad", ...textoLibre(350, "null") },
  nomEncargadoCompras: { tabla: "cia", columna: "nomEncargadoCompras", ...textoLibre(40, "null") },
  telEncargadoCompras: { tabla: "cia", columna: "telEncargadoCompras", ...textoLibre(40, "null") },
  nomEncargadoPagos: { tabla: "cia", columna: "nomEncargadoPagos", ...textoLibre(40, "null") },
  telEncargadoPagos: { tabla: "cia", columna: "telEncargadoPagos", ...textoLibre(40, "null") },
  COD_TIP_CL: {
    tabla: "cia", columna: "COD_TIP_CL", tipo: "catalogo", largo: 8, nombre: "tipo de cliente",
    existe: `SELECT 1 AS OK FROM COAGRO2.erpadmin.alFAC_TIP_CLT WHERE COD_TIP_CL = :valor`,
  },
  DIA_CRE: { tabla: "cia", columna: "DIA_CRE", ...numero(0, 99999, true) },
  LIM_CRE: { tabla: "cia", columna: "LIM_CRE", ...numero(0, 1e12) },
  POR_EXC_VT: { tabla: "cia", columna: "POR_EXC_VT", ...numero(0, 100) },
  POR_EXC_CS: { tabla: "cia", columna: "POR_EXC_CS", ...numero(0, 100) },
  DESCUENTO: { tabla: "cia", columna: "DESCUENTO", ...numero(0, 100) },
  IND_MON: { tabla: "cia", columna: "IND_MON", tipo: "opcion", opciones: ["L", "D"] },
  // Divisiones geograficas (catalogos de Softland): 1 = departamento, 2 = municipio, 3 = distrito.
  // Se validan contra erpadmin.DIVISION_GEOGRAFICA1/2/3 en validarDivision. "" -> NULL.
  DIVISION_GEOGRAFICA1: { tabla: "cia", columna: "DIVISION_GEOGRAFICA1", ...textoLibre(12, "null"), division: 1 },
  DIVISION_GEOGRAFICA2: { tabla: "cia", columna: "DIVISION_GEOGRAFICA2", ...textoLibre(12, "null"), division: 2 },
  DIVISION_GEOGRAFICA3: { tabla: "cia", columna: "division_geografica3", ...textoLibre(50, "null"), division: 3 },
  // erpadmin.RUTA_CLIENTE
  DIAS_VISITA: { tabla: "ruta", tipo: "dias" },
};

// Valida y convierte VALOR segun el campo. Devuelve { valor } o { error }.
const valorCambioCliente = async (CAMPO, def, VALOR) => {
  if (def.tipo === "numero") {
    const n = typeof VALOR === "string" && VALOR.trim() !== "" ? Number(VALOR.trim()) : VALOR;
    if (typeof n !== "number" || !Number.isFinite(n)) return { error: `${CAMPO} debe ser un numero` };
    if (def.entero && !Number.isInteger(n)) return { error: `${CAMPO} debe ser un numero entero` };
    if (n < def.min || n > def.max) return { error: `${CAMPO} debe estar entre ${def.min} y ${def.max}` };
    return { valor: n };
  }
  if (VALOR !== null && VALOR !== undefined && typeof VALOR === "object") {
    return { error: `${CAMPO} debe ser texto` };
  }
  const t = texto(VALOR);
  if (def.tipo === "opcion") {
    if (!def.opciones.includes(t)) return { error: `${CAMPO} debe ser ${def.opciones.join(" o ")}` };
    return { valor: t };
  }
  if (def.largo && t.length > def.largo) {
    return { error: `${CAMPO} supera el largo permitido (${def.largo} caracteres)` };
  }
  if (def.tipo === "catalogo") {
    if (!t) return { error: `${CAMPO} es obligatorio` };
    const [fila] = await sequelize.query(def.existe, { replacements: { valor: t }, type: QueryTypes.SELECT });
    if (!fila) return { error: `El ${def.nombre} ${t} no existe` };
    return { valor: t };
  }
  // Texto libre: "" -> error si es requerido, NULL o "" segun la columna.
  if (!t) {
    if (def.vacio === "requerido") return { error: `${CAMPO} es obligatorio` };
    return { valor: def.vacio === "null" ? null : "" };
  }
  return { valor: t };
};

// DIAS_VISITA: deja al cliente en UN dia de la ruta. Mismo dia que ya tiene -> no toca nada.
const cambiarDiaVisita = async (contexto, COD_CLT, c) => {
  const RUTA = texto(c.RUTA);
  const error = validarRutaCliente(contexto, RUTA, COD_CLT);
  if (error) return error;
  if (c.VALOR === null || c.VALOR === undefined || c.VALOR === "") return "DIAS_VISITA debe traer un dia";
  const dias = [...new Set((Array.isArray(c.VALOR) ? c.VALOR : [c.VALOR]).map(Number))];
  if (!dias.length) return "DIAS_VISITA debe traer un dia";
  if (dias.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    return "DIAS_VISITA: cada dia debe ser un entero entre 1 (lunes) y 7 (domingo)";
  }
  if (dias.length > 1) return "Un cliente solo puede tener un dia de visita por ruta";
  const replacements = { RUTA, COD_CLT, DIA: dias[0] };

  await sequelize.transaction(async (transaction) => {
    const actuales = await sequelize.query(
      `SELECT DIA FROM COAGRO2.erpadmin.RUTA_CLIENTE WITH (UPDLOCK, HOLDLOCK)
        WHERE RUTA = :RUTA AND CLIENTE = :COD_CLT`,
      { replacements, type: QueryTypes.SELECT, transaction }
    );
    if (actuales.length === 1 && Number(actuales[0].DIA) === replacements.DIA) return;
    await sequelize.query(
      `DELETE FROM COAGRO2.erpadmin.RUTA_CLIENTE WHERE RUTA = :RUTA AND CLIENTE = :COD_CLT AND DIA <> :DIA`,
      { replacements, transaction }
    );
    await sequelize.query(
      `IF NOT EXISTS (SELECT 1 FROM COAGRO2.erpadmin.RUTA_CLIENTE
                       WHERE RUTA = :RUTA AND CLIENTE = :COD_CLT AND DIA = :DIA)
         INSERT INTO COAGRO2.erpadmin.RUTA_CLIENTE (RUTA, CLIENTE, DIA, ORDEN)
         SELECT :RUTA, :COD_CLT, :DIA, ISNULL(MAX(ORDEN), 0) + 1
           FROM COAGRO2.erpadmin.RUTA_CLIENTE WITH (UPDLOCK, HOLDLOCK)
          WHERE RUTA = :RUTA AND DIA = :DIA`,
      { replacements, transaction }
    );
  });
  return null;
};

// Pais de las divisiones geograficas del cliente. CLIENTE_CIA.COD_PAIS en este ERP no siempre es un
// pais (alFAC_PAIS mezcla paises con vendedores, p. ej. 'VRR1'): si no tiene departamentos en
// erpadmin.DIVISION_GEOGRAFICA1 se usa FR_PAIS_DIVISION (por defecto 'ESA', el unico con divisiones).
const paisDivision = async (codPais) => {
  const pais = texto(codPais);
  if (pais) {
    const [hay] = await sequelize.query(
      `SELECT TOP 1 1 AS OK FROM COAGRO2.erpadmin.DIVISION_GEOGRAFICA1 WHERE PAIS = :pais`,
      { replacements: { pais }, type: QueryTypes.SELECT }
    );
    if (hay) return pais;
  }
  return texto(process.env.FR_PAIS_DIVISION) || "ESA";
};

// Valida un cambio de DIVISION_GEOGRAFICA1/2/3 contra erpadmin.DIVISION_GEOGRAFICA1/2/3 (ver comentario
// de procesarCambioCliente). `valor` ya viene normalizado (null = vaciar). Devuelve el error o null.
const validarDivision = async (contexto, COD_CLT, def, valor, cia) => {
  if (valor === null) return null;
  const pais = await paisDivision(cia.COD_PAIS);
  // Lo que vino en este envio para el cliente (ultimo valor de cada campo); si no, lo guardado.
  const envio = contexto.divisionesEnvio.get(COD_CLT) || {};
  const deEnvio = (campo, guardado) =>
    Object.prototype.hasOwnProperty.call(envio, campo) ? envio[campo] : texto(guardado);
  const depto = deEnvio("DIVISION_GEOGRAFICA1", cia.DIVISION_GEOGRAFICA1);
  const municipio = deEnvio("DIVISION_GEOGRAFICA2", cia.DIVISION_GEOGRAFICA2);
  const existe = async (tabla, where, replacements) =>
    (
      await sequelize.query(`SELECT TOP 1 1 AS OK FROM COAGRO2.erpadmin.${tabla} WHERE PAIS = :pais AND ${where}`, {
        replacements: { pais, ...replacements },
        type: QueryTypes.SELECT,
      })
    ).length > 0;

  if (def.division === 1) {
    const ok = await existe("DIVISION_GEOGRAFICA1", "DIVISION_GEOGRAFICA1 = :valor", { valor });
    return ok ? null : `El departamento ${valor} no existe (pais ${pais})`;
  }

  if (!depto) {
    return `No se puede validar ${def.division === 2 ? "el municipio" : "el distrito"} ${valor}: el cliente no tiene departamento`;
  }
  if (def.division === 2) {
    const ok = await existe(
      "DIVISION_GEOGRAFICA2",
      "DIVISION_GEOGRAFICA1 = :depto AND DIVISION_GEOGRAFICA2 = :valor",
      { depto, valor }
    );
    return ok ? null : `El municipio ${valor} no existe en el departamento ${depto}`;
  }

  if (!municipio) return `No se puede validar el distrito ${valor}: el cliente no tiene municipio`;
  const ok = await existe(
    "DIVISION_GEOGRAFICA3",
    "DIVISION_GEOGRAFICA1 = :depto AND DIVISION_GEOGRAFICA2 = :municipio AND DIVISION_GEOGRAFICA3 = :valor",
    { depto, municipio, valor }
  );
  return ok ? null : `El distrito ${valor} no existe en el municipio ${municipio} (departamento ${depto})`;
};

const procesarCambioCliente = async (contexto, c) => {
  const COD_CLT = texto(c.COD_CLT);
  const CAMPO = texto(c.CAMPO);
  const salida = { COD_CLT, CAMPO };
  const falla = (error) => ({ ...salida, ok: false, error });

  if (!COD_CLT) return falla("COD_CLT es obligatorio");
  const def = Object.prototype.hasOwnProperty.call(CAMPOS_CAMBIO_CLIENTE, CAMPO) ? CAMPOS_CAMBIO_CLIENTE[CAMPO] : null;
  if (!def) return falla(`Campo no editable: ${CAMPO}`);
  if (!contexto.clientesDeLaHandheld.has(COD_CLT)) {
    return falla(`El cliente ${COD_CLT} no esta asignado a ninguna ruta de esta handheld`);
  }

  try {
    if (def.tipo === "dias") {
      const error = await cambiarDiaVisita(contexto, COD_CLT, c);
      return error ? falla(error) : { ...salida, ok: true };
    }

    if (def.tabla === "cliente") {
      const v = await valorCambioCliente(CAMPO, def, c.VALOR);
      if (v.error) return falla(v.error);
      // Todas las filas del cliente (una por COD_ZON).
      const [fila] = await sequelize.query(
        `UPDATE COAGRO2.erpadmin.cliente SET ${def.columna} = :valor WHERE COD_CLT = :COD_CLT;
         SELECT @@ROWCOUNT AS N;`,
        { replacements: { valor: v.valor, COD_CLT }, type: QueryTypes.SELECT }
      );
      if (!fila || !fila.N) return falla(`El cliente ${COD_CLT} no existe en erpadmin.cliente`);
      return { ...salida, ok: true };
    }

    // CLIENTE_CIA: la fila de COD_CIA si viene; si no, la misma que manda /fr/sync/clientes.
    const COD_CIA = texto(c.COD_CIA);
    const [cia] = await sequelize.query(
      `SELECT TOP 1 COD_CIA, COD_PAIS, DIVISION_GEOGRAFICA1, DIVISION_GEOGRAFICA2 FROM COAGRO2.erpadmin.CLIENTE_CIA
        WHERE COD_CLT = :COD_CLT AND (:COD_CIA = '' OR COD_CIA = :COD_CIA)
        ORDER BY CASE WHEN COD_CIA = 'CINCOH' THEN 0 ELSE 1 END, COD_CIA`,
      { replacements: { COD_CLT, COD_CIA }, type: QueryTypes.SELECT }
    );
    if (!cia) {
      return falla(
        `El cliente ${COD_CLT} no tiene datos ${COD_CIA ? `de la compania ${COD_CIA} ` : "de compania "}(CLIENTE_CIA)`
      );
    }
    const v = await valorCambioCliente(CAMPO, def, c.VALOR);
    if (v.error) return falla(v.error);
    if (def.division) {
      const error = await validarDivision(contexto, COD_CLT, def, v.valor, cia);
      if (error) return falla(error);
    }
    await sequelize.query(
      `UPDATE COAGRO2.erpadmin.CLIENTE_CIA SET ${def.columna} = :valor WHERE COD_CLT = :COD_CLT AND COD_CIA = :COD_CIA`,
      { replacements: { valor: v.valor, COD_CLT, COD_CIA: cia.COD_CIA } }
    );
    return { ...salida, ok: true };
  } catch (e) {
    console.log(e);
    return falla(mensajeError(e));
  }
};

// COD_CLT -> { DIVISION_GEOGRAFICA1?, DIVISION_GEOGRAFICA2?, DIVISION_GEOGRAFICA3? } con el ultimo
// valor recibido de cada uno ("" = lo vacian).
const divisionesDelEnvio = (cambios) => {
  const mapa = new Map();
  for (const c of cambios) {
    const CAMPO = texto(c && c.CAMPO);
    const def = Object.prototype.hasOwnProperty.call(CAMPOS_CAMBIO_CLIENTE, CAMPO) ? CAMPOS_CAMBIO_CLIENTE[CAMPO] : null;
    if (!def || !def.division) continue;
    const COD_CLT = texto(c.COD_CLT);
    if (!mapa.has(COD_CLT)) mapa.set(COD_CLT, {});
    mapa.get(COD_CLT)[CAMPO] = c.VALOR !== null && typeof c.VALOR === "object" ? "" : texto(c.VALOR);
  }
  return mapa;
};

const postSyncEnviar = async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.send({ result: {}, success: false, errors: ["El cuerpo debe ser un objeto JSON"] });
    }
    for (const k of ["ubicaciones", "visitas", "pedidos", "aprobaciones", "notasCredito", "inventarios", "depositos", "promocionales", "consecutivos", "cambiosCliente"]) {
      if (body[k] !== undefined && body[k] !== null && !Array.isArray(body[k])) {
        return res.send({ result: {}, success: false, errors: [`${k} debe ser un arreglo`] });
      }
    }
    const ubicaciones = body.ubicaciones || [];
    const visitas = body.visitas || [];
    const pedidos = body.pedidos || [];
    const aprobaciones = body.aprobaciones || [];
    const notasCredito = body.notasCredito || [];
    const inventarios = body.inventarios || [];
    const depositos = body.depositos || [];
    const promocionales = body.promocionales || [];
    const consecutivos = body.consecutivos || [];
    const cambiosCliente = body.cambiosCliente || [];

    // Contexto para validar: rutas de la handheld, sus clientes y los articulos de pedidos y notas de credito.
    const asignaciones = await sequelize.query(
      `SELECT RUTA, CLIENTE FROM COAGRO2.erpadmin.RUTA_CLIENTE WHERE RUTA IN (:rutas)`,
      { replacements: { rutas: req.mobile.codigosRuta }, type: QueryTypes.SELECT }
    );
    const codigosArt = [
      ...new Set(
        [...pedidos, ...notasCredito, ...inventarios].flatMap((p) =>
          (Array.isArray(p && p.lineas) ? p.lineas : []).map((l) => texto(l && l.COD_ART))
        )
      ),
    ].filter(Boolean);
    const articulos = await porLotes(codigosArt, (lote) =>
      sequelize.query(`SELECT COD_ART, FACTOR_VENTA FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART IN (:lote)`, {
        replacements: { lote },
        type: QueryTypes.SELECT,
      })
    );
    const cuentasBanco = depositos.length
      ? await sequelize.query(`SELECT COD_CIA, COD_BCO, CTA_BCO FROM COAGRO2.erpadmin.alCXC_CTA_BCO`, {
          type: QueryTypes.SELECT,
        })
      : [];
    const contexto = {
      cuentasBanco: new Set(cuentasBanco.map((c) => `${texto(c.COD_CIA)}|${texto(c.COD_BCO)}|${texto(c.CTA_BCO)}`)),
      rutas: new Set(req.mobile.codigosRuta),
      asignaciones: new Set(asignaciones.map((a) => `${texto(a.RUTA)}|${texto(a.CLIENTE)}`)),
      clientesDeLaHandheld: new Set(asignaciones.map((a) => texto(a.CLIENTE))),
      articulos: new Set(articulos.map((a) => texto(a.COD_ART))),
      // FACTOR_VENTA por articulo, para pasar CNT_MAX + CNT_MIN a unidades de la factura (notas de credito).
      factorVenta: new Map(articulos.map((a) => [texto(a.COD_ART), Number(a.FACTOR_VENTA) || 0])),
      handheld: texto(req.mobile.handheld && req.mobile.handheld.HANDHELD),
      agenteDeRuta: new Map(req.mobile.rutas.map((r) => [texto(r.RUTA), texto(r.AGENTE)])),
      // Ultimo DIVISION_GEOGRAFICA1/2/3 de cada cliente en este envio (para validarDivision).
      divisionesEnvio: divisionesDelEnvio(cambiosCliente),
      // null = validacion de descuento apagada (FR_VALIDAR_DESCUENTO distinto de S).
      topesDescuento: validarDescuentoActiva() && pedidos.length ? await topesDePedidos(pedidos) : null,
      // Bonificacion permitida por pedido (solo los que traen lineas ART_BON '1'); ver utils/bonificacionFr.js.
      bonificaciones: pedidos.some(pedidoConBonificacion) ? await calcularBonificacionesPermitidas(pedidos) : null,
    };

    // Orden: ubicaciones, visitas, pedidos, aprobaciones, notasCredito, inventarios, depositos,
    // promocionales, consecutivos, cambiosCliente.
    const result = {
      ubicaciones: [],
      visitas: [],
      pedidos: [],
      aprobaciones: [],
      notasCredito: [],
      inventarios: [],
      depositos: [],
      promocionales: [],
      consecutivos: [],
      cambiosCliente: [],
    };
    for (const u of ubicaciones) result.ubicaciones.push(await procesarUbicacion(contexto, u || {}));
    for (const v of visitas) result.visitas.push(await procesarVisita(contexto, v || {}));
    for (const p of pedidos) result.pedidos.push(await procesarPedido(contexto, p || {}));
    for (const a of aprobaciones) result.aprobaciones.push(await procesarAprobacion(contexto, a || {}));
    for (const n of notasCredito) result.notasCredito.push(await procesarNotaCredito(contexto, n || {}));
    for (const i of inventarios) result.inventarios.push(await procesarInventario(contexto, i || {}));
    for (const d of depositos) result.depositos.push(await procesarDeposito(contexto, d || {}));
    for (const p of promocionales) result.promocionales.push(await procesarPromocional(contexto, p || {}));
    for (const c of consecutivos) result.consecutivos.push(await procesarConsecutivo(contexto, c || {}));
    for (const c of cambiosCliente) result.cambiosCliente.push(await procesarCambioCliente(contexto, c || {}));

    res.send({ result, success: true, errors: [] });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al procesar el envio de la handheld"] });
  }
};

// Las columnas tambien las usan GET /fr/sync/cotizaciones, /notasCredito e /inventarios (controllers/fr/sync.js).
module.exports = {
  postSyncEnviar, COLUMNAS_ENC, COLUMNAS_DET, FECHAS_ENC, COLUMNAS_ENC_DEV, COLUMNAS_DET_DEV, FECHAS_ENC_DEV,
  FECHAS_ENC_INV,
  IND_DEV_NC, MOTIVOS_NC,
};
