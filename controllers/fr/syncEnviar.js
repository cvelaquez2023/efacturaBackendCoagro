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
//   - RUTA_CONSECUT_RT   <- consecutivos  (PEDIDO y/o FACTURA de la ruta, solo si avanzan)
//
// Request (cualquier arreglo puede venir vacio u omitirse):
// {
//   ubicaciones: [{ RUTA, CLIENTE, LATITUD, LONGITUD, ALTITUD }],
//   visitas:     [{ CLIENTE, RUTA, INICIO, FIN, FECHA_PLAN, NOTAS, TIPO, RAZON,
//                   ubicacion: { LATITUD, LONGITUD, ALTITUD, TIEMPO_GPS, TIEMPO_PDA } | null }],
//   pedidos:     [{ encabezado: { COD_CIA, COD_ZON, COD_CLT, NUM_PED, ... }, lineas: [{ NUM_LN, COD_ART, ... }] }],
//   aprobaciones: [{ COD_CIA, COD_ZON, NUM_PED, FEC_PED, FEC_DES? }],   // cotizaciones que el vendedor aprobo
//   consecutivos: [{ RUTA, PEDIDO?, FACTURA? }]   // siguiente pedido / cotizacion de la ruta, ya incrementado por la app
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
//     consecutivos: [{ RUTA, PEDIDO, FACTURA?, ok, ignorado?, actual?, ignoradoFactura?, actualFactura?, error? }]
//   }
// }
// success: false solo si el request entero es invalido (formato); el token lo valida mobileSession (401).
//
// Notas:
//  - Se procesa en orden: ubicaciones, visitas, pedidos, aprobaciones, consecutivos. Cada registro es
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

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");

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
  const salida = { RUTA, PEDIDO };
  if (FACTURA) salida.FACTURA = FACTURA;
  if (!RUTA || (!PEDIDO && !FACTURA)) {
    return { ...salida, ok: false, error: "RUTA y PEDIDO o FACTURA son obligatorios" };
  }
  if (!contexto.rutas.has(RUTA)) return { ...salida, ok: false, error: `La ruta ${RUTA} no pertenece a esta handheld` };

  try {
    return await sequelize.transaction(async (transaction) => {
      const [fila] = await sequelize.query(
        `SELECT PEDIDO, FACTURA FROM COAGRO2.erpadmin.RUTA_CONSECUT_RT WITH (UPDLOCK) WHERE RUTA = :RUTA`,
        { replacements: { RUTA }, type: QueryTypes.SELECT, transaction }
      );
      if (!fila) return { ...salida, ok: false, error: `La ruta ${RUTA} no tiene consecutivos configurados` };

      const respuesta = { ...salida, ok: true };
      const sets = [];
      const campos = [
        { columna: "PEDIDO", valor: PEDIDO, ignorado: "ignorado", actual: "actual" },
        { columna: "FACTURA", valor: FACTURA, ignorado: "ignoradoFactura", actual: "actualFactura" },
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
          { replacements: { RUTA, PEDIDO, FACTURA }, transaction }
        );
      }
      return respuesta;
    });
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
    for (const k of ["ubicaciones", "visitas", "pedidos", "aprobaciones", "consecutivos"]) {
      if (body[k] !== undefined && body[k] !== null && !Array.isArray(body[k])) {
        return res.send({ result: {}, success: false, errors: [`${k} debe ser un arreglo`] });
      }
    }
    const ubicaciones = body.ubicaciones || [];
    const visitas = body.visitas || [];
    const pedidos = body.pedidos || [];
    const aprobaciones = body.aprobaciones || [];
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

    // Orden: ubicaciones, visitas, pedidos, aprobaciones, consecutivos.
    const result = { ubicaciones: [], visitas: [], pedidos: [], aprobaciones: [], consecutivos: [] };
    for (const u of ubicaciones) result.ubicaciones.push(await procesarUbicacion(contexto, u || {}));
    for (const v of visitas) result.visitas.push(await procesarVisita(contexto, v || {}));
    for (const p of pedidos) result.pedidos.push(await procesarPedido(contexto, p || {}));
    for (const a of aprobaciones) result.aprobaciones.push(await procesarAprobacion(contexto, a || {}));
    for (const c of consecutivos) result.consecutivos.push(await procesarConsecutivo(contexto, c || {}));

    res.send({ result, success: true, errors: [] });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al procesar el envio de la handheld"] });
  }
};

// Las columnas tambien las usa GET /fr/sync/cotizaciones (controllers/fr/sync.js).
module.exports = { postSyncEnviar, COLUMNAS_ENC, COLUMNAS_DET, FECHAS_ENC };
