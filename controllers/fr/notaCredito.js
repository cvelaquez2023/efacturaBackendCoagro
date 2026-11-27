//
// Consulta (web) de las notas de credito que envian las handhelds por POST /fr/sync/enviar
// (notasCredito). Solo lectura: las crea unicamente la app movil.
//
// Tablas:
//   - erpadmin.alFAC_ENC_DEV -> encabezado (PK COD_CIA + COD_ZON + NUM_DEV)
//   - erpadmin.alFAC_DET_DEV -> lineas (misma llave + COD_ART, IND_DEV, LOTE_HIST, LOTE, ART_BON)
//   - erpadmin.cliente       -> nombre del cliente (COD_CLT)
//   - erpadmin.RUTA_RT       -> nombre de la ruta (RUTA = COD_ZON)
//   - erpadmin.ARTICULO      -> descripcion del articulo (COD_ART)
//
// Filtros (query): ?ruta, ?cliente, ?estado (EST_DEV), ?docPro, ?notaCredito (NUM_DEV, parcial),
// ?referencia (NUM_REF, parcial), ?desde=YYYY-MM-DD, ?hasta=YYYY-MM-DD (por FEC_DEV, ambos
// inclusive), mas ?page y ?limit.
//
// Notas:
//  - Los nombres se buscan con OUTER APPLY (TOP 1) para no duplicar filas.
//  - Las fechas se pasan como 'YYYYMMDD' (SQL Server las interpreta igual sin importar DATEFORMAT).
//  - Se agrega MOTIVO (descripcion de COD_MODIFICACION) al encabezado e IND_DEV_DESCRIPCION a cada
//    linea, con los catalogos de la app (syncEnviar.js: MOTIVOS_NC, IND_DEV_NC).
//  - Fechas del encabezado (HOR_INI, HOR_FIN, FEC_DEV) como texto 'YYYY-MM-DD HH:MM:SS', tal cual
//    estan guardadas (hora local, sin zona horaria), igual que GET /fr/sync/notasCredito.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");
const { IND_DEV_NC, MOTIVOS_NC, COLUMNAS_ENC_DEV, FECHAS_ENC_DEV } = require("./syncEnviar");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Todas las columnas de alFAC_ENC_DEV; las fechas convertidas a texto (estilo 120).
const COLUMNAS_SELECT = ["NUM_DEV", "COD_CIA", "COD_ZON", "DOC_PRO", ...COLUMNAS_ENC_DEV]
  .map((c) => (FECHAS_ENC_DEV.includes(c) ? `CONVERT(varchar(19), E.${c}, 120) AS ${c}` : `E.${c}`))
  .join(", ");

const SELECT_ENC = `
  SELECT ${COLUMNAS_SELECT}, C.NOM_CLT AS CLIENTE_NOMBRE, R.DESCRIPCION AS RUTA_DESCRIPCION
    FROM COAGRO2.erpadmin.alFAC_ENC_DEV E
    OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente WHERE COD_CLT = E.COD_CLT) C
    OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT WHERE RUTA = E.COD_ZON) R`;

// Agrega la descripcion de los codigos de la app (MOTIVO del encabezado, IND_DEV_DESCRIPCION de la linea).
const conMotivo = (e) => ({ ...e, MOTIVO: MOTIVOS_NC[String(e.COD_MODIFICACION || "").trim()] || null });
const conIndDev = (l) => ({ ...l, IND_DEV_DESCRIPCION: IND_DEV_NC[String(l.IND_DEV || "").trim()] || null });

// Arma el WHERE y los replacements a partir del query string. { error } si una fecha viene mal.
const armarFiltros = (query) => {
  const { ruta, cliente, estado, docPro, notaCredito, referencia, desde, hasta } = query;
  const condiciones = [];
  const replacements = {};
  const igual = (valor, columna, nombre) => {
    if (!valor) return;
    condiciones.push(`E.${columna} = :${nombre}`);
    replacements[nombre] = valor;
  };
  const parcial = (valor, columna, nombre) => {
    if (!valor) return;
    condiciones.push(`E.${columna} LIKE :${nombre}`);
    replacements[nombre] = `%${valor}%`;
  };

  igual(ruta, "COD_ZON", "ruta");
  igual(cliente, "COD_CLT", "cliente");
  igual(estado, "EST_DEV", "estado");
  igual(docPro, "DOC_PRO", "docPro");
  parcial(notaCredito, "NUM_DEV", "notaCredito");
  parcial(referencia, "NUM_REF", "referencia");

  if (desde) {
    if (!FECHA_REGEX.test(desde)) return { error: "El campo desde debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_DEV >= CAST(:desde AS datetime)");
    replacements.desde = desde.replace(/-/g, "");
  }
  if (hasta) {
    if (!FECHA_REGEX.test(hasta)) return { error: "El campo hasta debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_DEV < DATEADD(day, 1, CAST(:hasta AS datetime))");
    replacements.hasta = hasta.replace(/-/g, "");
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "",
    replacements,
  };
};

const pagination = (total, { page, limit }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});

// GET /fr/notaCredito?ruta=&cliente=&estado=&docPro=&notaCredito=&referencia=&desde=&hasta=&page=1&limit=20
// Listado: una fila por nota de credito (todas las columnas del encabezado) con nombre de cliente y ruta.
const getNotasCredito = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `${SELECT_ENC}
         ${filtros.where}
         ORDER BY E.FEC_DEV DESC, E.NUM_DEV DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { replacements: { ...filtros.replacements, offset, limit }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL FROM COAGRO2.erpadmin.alFAC_ENC_DEV E ${filtros.where}`,
        { replacements: filtros.replacements, type: QueryTypes.SELECT }
      ),
    ]);

    res.send({
      result: rows.map(conMotivo),
      success: true,
      pagination: pagination(conteo[0].TOTAL, { page, limit }),
    });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar las notas de credito"] });
  }
};

// GET /fr/notaCredito/:cia/:ruta/:notaCredito
// Detalle: encabezado y lineas (con la descripcion del articulo).
const getNotaCredito = async (req, res) => {
  try {
    const { cia, ruta, notaCredito } = req.params;
    const replacements = { cia, ruta, notaCredito };

    const [[encabezado], lineas] = await Promise.all([
      sequelize.query(
        `${SELECT_ENC}
         WHERE E.COD_CIA = :cia AND E.COD_ZON = :ruta AND E.NUM_DEV = :notaCredito`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.*, A.DES_ART
           FROM COAGRO2.erpadmin.alFAC_DET_DEV D
           OUTER APPLY (SELECT TOP 1 DES_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART = D.COD_ART) A
          WHERE D.COD_CIA = :cia AND D.COD_ZON = :ruta AND D.NUM_DEV = :notaCredito
          ORDER BY D.COD_ART, D.IND_DEV, D.LOTE`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    if (!encabezado) {
      return res.send({ result: {}, success: false, errors: ["La nota de credito no existe"] });
    }

    res.send({ result: { encabezado: conMotivo(encabezado), lineas: lineas.map(conIndDev) }, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar la nota de credito"] });
  }
};

module.exports = { getNotasCredito, getNotaCredito };
