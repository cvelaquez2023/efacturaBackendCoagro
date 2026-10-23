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
//   - RUTA_CONSECUT_RT   <- consecutivos  (PEDIDO de la ruta, tal como lo manda la app)
//
// Request (cualquier arreglo puede venir vacio u omitirse):
// {
//   ubicaciones: [{ RUTA, CLIENTE, LATITUD, LONGITUD, ALTITUD }],
//   visitas:     [{ CLIENTE, RUTA, INICIO, FIN, FECHA_PLAN, NOTAS, TIPO, RAZON,
//                   ubicacion: { LATITUD, LONGITUD, ALTITUD, TIEMPO_GPS, TIEMPO_PDA } | null }],
//   pedidos:     [{ encabezado: { COD_CIA, COD_ZON, COD_CLT, NUM_PED, ... }, lineas: [{ NUM_LN, COD_ART, ... }] }],
//   consecutivos: [{ RUTA, PEDIDO }]   // siguiente numero de pedido de la ruta, ya incrementado por la app
// }
// Fechas como texto 'YYYY-MM-DD HH:MM:SS' en hora local; se guardan tal cual (sin zona horaria).
//
// Respuesta: resultado POR REGISTRO, para que la app marque como enviado solo lo que quedo.
// {
//   success: true, errors: [],
//   result: {
//     ubicaciones:  [{ RUTA, CLIENTE, ok, error? }],
//     visitas:      [{ CLIENTE, RUTA, INICIO, ok, duplicado?, error? }],
//     pedidos:      [{ COD_ZON, NUM_PED, ok, duplicado?, error? }],
//     consecutivos: [{ RUTA, PEDIDO, ok, error? }]
//   }
// }
// success: false solo si el request entero es invalido (formato); el token lo valida mobileSession (401).
//
// Notas:
//  - Se procesa en orden: ubicaciones, visitas, pedidos, consecutivos. Cada registro es independiente: uno con
//    error no impide guardar los demas.
//  - No duplica: un pedido o visita que ya existe responde ok con duplicado: true y NO se
//    sobrescribe (el celular puede reenviar lo mismo si se corto la respuesta).
//  - Cada pedido (encabezado + lineas) va en su propia transaccion.
//  - La ruta debe ser de la handheld del token y el cliente debe estar en RUTA_CLIENTE de esa ruta.
//  - TIP_DOC se guarda siempre 'F' (columna varchar(1)). COD_CIA, NUM_PED y TIP_DOC de las
//    lineas salen del encabezado. SUBTIPO_DESCRIPCION no existe en alFAC_ENC_PED: se ignora.
//  - alFAC_DET_PED no tiene COD_ZON: un NUM_PED no puede repetirse entre rutas de la misma compania.
//  - Consecutivo: la app lleva la cuenta y manda el SIGUIENTE numero de pedido de cada ruta; el
//    backend lo guarda tal cual en RUTA_CONSECUT_RT.PEDIDO (no lo calcula ni lo compara). Asi
//    GET /fr/sync/consecutivos lo devuelve en la siguiente carga.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const TIP_DOC = "F";

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

const procesarPedido = async (contexto, p) => {
  const enc = (p && p.encabezado) || {};
  const lineas = Array.isArray(p && p.lineas) ? p.lineas : [];
  const COD_ZON = texto(enc.COD_ZON);
  const NUM_PED = texto(enc.NUM_PED);
  const COD_CIA = texto(enc.COD_CIA);
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
    await sequelize.transaction(async (transaction) => {
      // Las lineas se unen solo por COD_CIA + NUM_PED: el numero no puede estar en otra ruta.
      const [existe] = await sequelize.query(
        `SELECT TOP 1 COD_ZON FROM COAGRO2.erpadmin.alFAC_ENC_PED WITH (UPDLOCK)
          WHERE COD_CIA = :COD_CIA AND NUM_PED = :NUM_PED`,
        { replacements: { COD_CIA, NUM_PED }, type: QueryTypes.SELECT, transaction }
      );
      if (existe && texto(existe.COD_ZON) !== COD_ZON) {
        throw new Error(`El pedido ${NUM_PED} ya existe en la ruta ${texto(existe.COD_ZON)}`);
      }

      if (existe) {
        duplicado = true;
      } else {
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
    return { ...salida, ok: true, duplicado };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

const procesarConsecutivo = async (contexto, c) => {
  const RUTA = texto(c.RUTA);
  const PEDIDO = texto(c.PEDIDO);
  const salida = { RUTA, PEDIDO };
  if (!RUTA || !PEDIDO) return { ...salida, ok: false, error: "RUTA y PEDIDO son obligatorios" };
  if (!contexto.rutas.has(RUTA)) return { ...salida, ok: false, error: `La ruta ${RUTA} no pertenece a esta handheld` };

  try {
    const [, filas] = await sequelize.query(
      `UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT SET PEDIDO = :PEDIDO WHERE RUTA = :RUTA`,
      { replacements: { RUTA, PEDIDO } }
    );
    if (!filas) return { ...salida, ok: false, error: `La ruta ${RUTA} no tiene consecutivos configurados` };
    return { ...salida, ok: true };
  } catch (e) {
    console.log(e);
    return { ...salida, ok: false, error: mensajeError(e) };
  }
};

const postSyncEnviar = async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.send({ result: {}, success: false, errors: ["El cuerpo debe ser un objeto JSON"] });
    }
    for (const k of ["ubicaciones", "visitas", "pedidos", "consecutivos"]) {
      if (body[k] !== undefined && body[k] !== null && !Array.isArray(body[k])) {
        return res.send({ result: {}, success: false, errors: [`${k} debe ser un arreglo`] });
      }
    }
    const ubicaciones = body.ubicaciones || [];
    const visitas = body.visitas || [];
    const pedidos = body.pedidos || [];
    const consecutivos = body.consecutivos || [];

    // Contexto para validar: rutas de la handheld, sus clientes y los articulos de los pedidos.
    const asignaciones = await sequelize.query(
      `SELECT RUTA, CLIENTE FROM COAGRO2.erpadmin.RUTA_CLIENTE WHERE RUTA IN (:rutas)`,
      { replacements: { rutas: req.mobile.codigosRuta }, type: QueryTypes.SELECT }
    );
    const codigosArt = [
      ...new Set(
        pedidos.flatMap((p) => (Array.isArray(p && p.lineas) ? p.lineas : []).map((l) => texto(l.COD_ART)))
      ),
    ].filter(Boolean);
    const articulos = await porLotes(codigosArt, (lote) =>
      sequelize.query(`SELECT COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART IN (:lote)`, {
        replacements: { lote },
        type: QueryTypes.SELECT,
      })
    );
    const contexto = {
      rutas: new Set(req.mobile.codigosRuta),
      asignaciones: new Set(asignaciones.map((a) => `${texto(a.RUTA)}|${texto(a.CLIENTE)}`)),
      articulos: new Set(articulos.map((a) => texto(a.COD_ART))),
    };

    // Orden: ubicaciones, visitas, pedidos, consecutivos.
    const result = { ubicaciones: [], visitas: [], pedidos: [], consecutivos: [] };
    for (const u of ubicaciones) result.ubicaciones.push(await procesarUbicacion(contexto, u || {}));
    for (const v of visitas) result.visitas.push(await procesarVisita(contexto, v || {}));
    for (const p of pedidos) result.pedidos.push(await procesarPedido(contexto, p || {}));
    for (const c of consecutivos) result.consecutivos.push(await procesarConsecutivo(contexto, c || {}));

    res.send({ result, success: true, errors: [] });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al procesar el envio de la handheld"] });
  }
};

module.exports = { postSyncEnviar };
