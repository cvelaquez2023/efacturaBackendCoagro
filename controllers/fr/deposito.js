//
// Consulta (web) de los recibos de cobro / depositos que suben las handhelds. Solo lectura.
// Los graba la app en POST /fr/sync/enviar (arreglo `depositos`, ver controllers/fr/syncEnviar.js).
//
// Tablas:
//   - erpadmin.alCXC_ENC_DEP      -> encabezado (NUM_DEP = numero de recibo, CONSEC_DEP = IDENTITY)
//   - erpadmin.alCXC_DET_DEP      -> lineas, una por documento (se unen por NUM_DEP + CTA_BCO, como el envio)
//   - erpadmin.alCXC_CTA_BCO      -> NOM_CTA (COD_CIA + COD_BCO + CTA_BCO)
//   - erpadmin.alCXC_PEN_COB      -> cliente/ruta/tipo del documento (NUM_DOC)
//   - erpadmin.alFAC_ENC_HIST_FAC -> respaldo de cliente/ruta si el documento ya no esta en PEN_COB
//   - erpadmin.cliente            -> NOM_CLT
//
// Endpoints:
//   GET /fr/deposito?handheld=&codCia=&codBco=&ctaBco=&indMon=&docPro=&desde=&hasta=&q=&page=&limit=
//       Lista paginada de encabezados con NOM_CTA, cantidad de lineas y totales por forma de pago.
//       desde/hasta: YYYY-MM-DD sobre FEC_DEP (ambos inclusive). docPro: S (aplicado) / N (pendiente,
//       incluye null). q: NUM_DEP o NOTAS parcial.
//   GET /fr/deposito/:consecDep
//       Encabezado + lineas (con cliente, ruta y tipo de documento de cada NUM_DOC).
//
// Fechas como texto 'YYYY-MM-DD HH:MM:SS'; montos null -> 0; textos sin espacios.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const SELECT_ENCABEZADO = `
  SELECT E.CONSEC_DEP, LTRIM(RTRIM(E.NUM_DEP)) AS NUM_DEP,
         LTRIM(RTRIM(E.COD_CIA)) AS COD_CIA, LTRIM(RTRIM(E.COD_BCO)) AS COD_BCO,
         LTRIM(RTRIM(E.CTA_BCO)) AS CTA_BCO, LTRIM(RTRIM(C.NOM_CTA)) AS NOM_CTA,
         ISNULL(E.MON_DEP, 0) AS MON_DEP, CONVERT(varchar(19), E.FEC_DEP, 120) AS FEC_DEP,
         LTRIM(RTRIM(E.IND_MON)) AS IND_MON, LTRIM(RTRIM(E.NOTAS)) AS NOTAS,
         ISNULL(LTRIM(RTRIM(E.DOC_PRO)), 'N') AS DOC_PRO, LTRIM(RTRIM(E.HandHeld)) AS HANDHELD,
         ISNULL(T.LINEAS, 0) AS LINEAS,
         ISNULL(T.TOTAL_EFE, 0) AS TOTAL_EFE, ISNULL(T.TOTAL_CHE, 0) AS TOTAL_CHE,
         ISNULL(T.TOTAL_DEP, 0) AS TOTAL_DEP, ISNULL(T.TOTAL_TRA, 0) AS TOTAL_TRA
    FROM COAGRO2.erpadmin.alCXC_ENC_DEP E
    LEFT JOIN COAGRO2.erpadmin.alCXC_CTA_BCO C
      ON C.COD_CIA = E.COD_CIA AND C.COD_BCO = E.COD_BCO AND C.CTA_BCO = E.CTA_BCO
    OUTER APPLY (SELECT COUNT(*) AS LINEAS,
                        SUM(ISNULL(D.MON_EFE, 0)) AS TOTAL_EFE, SUM(ISNULL(D.MON_CHE, 0)) AS TOTAL_CHE,
                        SUM(ISNULL(D.MON_DEP, 0)) AS TOTAL_DEP, SUM(ISNULL(D.MON_TRA, 0)) AS TOTAL_TRA
                   FROM COAGRO2.erpadmin.alCXC_DET_DEP D
                  WHERE D.NUM_DEP = E.NUM_DEP AND D.CTA_BCO = E.CTA_BCO) T`;

// Arma el WHERE y los replacements a partir del query string. Devuelve { error } si un filtro es invalido.
const armarFiltros = (query) => {
  const condiciones = [];
  const replacements = {};
  const igual = { handheld: "E.HandHeld", codCia: "E.COD_CIA", codBco: "E.COD_BCO", ctaBco: "E.CTA_BCO" };

  for (const [param, columna] of Object.entries(igual)) {
    const v = texto(query[param]);
    if (v) {
      condiciones.push(`${columna} = :${param}`);
      replacements[param] = v;
    }
  }

  const indMon = texto(query.indMon).toUpperCase();
  if (indMon) {
    if (!["L", "D"].includes(indMon)) return { error: "indMon debe ser L (local) o D (dolar)" };
    condiciones.push("E.IND_MON = :indMon");
    replacements.indMon = indMon;
  }

  const docPro = texto(query.docPro).toUpperCase();
  if (docPro) {
    if (!["S", "N"].includes(docPro)) return { error: "docPro debe ser S (aplicado) o N (pendiente)" };
    condiciones.push("ISNULL(E.DOC_PRO, 'N') = :docPro");
    replacements.docPro = docPro;
  }

  const desde = texto(query.desde);
  if (desde) {
    if (!FORMATO_FECHA.test(desde)) return { error: "desde debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_DEP >= CONVERT(date, :desde, 23)");
    replacements.desde = desde;
  }
  const hasta = texto(query.hasta);
  if (hasta) {
    if (!FORMATO_FECHA.test(hasta)) return { error: "hasta debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_DEP < DATEADD(day, 1, CONVERT(date, :hasta, 23))");
    replacements.hasta = hasta;
  }

  const q = texto(query.q);
  if (q) {
    condiciones.push("(E.NUM_DEP LIKE :q OR E.NOTAS LIKE :q)");
    replacements.q = `%${q}%`;
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "",
    replacements,
  };
};

// GET /fr/deposito
const getDepositos = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `${SELECT_ENCABEZADO}
          ${filtros.where}
          ORDER BY E.FEC_DEP DESC, E.CONSEC_DEP DESC
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { replacements: { ...filtros.replacements, offset, limit }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL FROM COAGRO2.erpadmin.alCXC_ENC_DEP E ${filtros.where}`,
        { replacements: filtros.replacements, type: QueryTypes.SELECT }
      ),
    ]);

    const total = conteo[0].TOTAL;
    res.send({
      result: rows,
      success: true,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar los depositos"] });
  }
};

// GET /fr/deposito/:consecDep
const getDeposito = async (req, res) => {
  try {
    const consecDep = texto(req.params.consecDep);
    if (!/^\d+$/.test(consecDep)) {
      return res.send({ result: {}, success: false, errors: ["consecDep debe ser un numero"] });
    }

    const [encabezado] = await sequelize.query(`${SELECT_ENCABEZADO} WHERE E.CONSEC_DEP = :consecDep`, {
      replacements: { consecDep: Number(consecDep) },
      type: QueryTypes.SELECT,
    });
    if (!encabezado) {
      return res.send({ result: {}, success: false, errors: [`No existe el deposito ${consecDep}`] });
    }

    // Cliente/ruta: ENC/DET no los guardan; salen de NUM_DOC (PEN_COB y, si ya se cancelo, HIST_FAC).
    // OUTER APPLY TOP 1 (primero la misma compania) para no duplicar lineas.
    const lineas = await sequelize.query(
      `SELECT LTRIM(RTRIM(D.NUM_DOC)) AS NUM_DOC,
              LTRIM(RTRIM(P.COD_TIP_DC)) AS COD_TIP_DC, LTRIM(RTRIM(P.CLASE_DOCUMENTO)) AS CLASE_DOCUMENTO,
              LTRIM(RTRIM(COALESCE(P.COD_CLT, F.COD_CLT))) AS COD_CLT, LTRIM(RTRIM(CL.NOM_CLT)) AS NOM_CLT,
              LTRIM(RTRIM(COALESCE(P.COD_ZON, F.COD_ZON))) AS COD_ZON,
              ISNULL(D.MON_EFE, 0) AS MON_EFE, ISNULL(D.MON_CHE, 0) AS MON_CHE,
              ISNULL(D.MON_DEP, 0) AS MON_DEP, ISNULL(D.MON_TRA, 0) AS MON_TRA,
              LTRIM(RTRIM(D.REF)) AS REF
         FROM COAGRO2.erpadmin.alCXC_DET_DEP D
         OUTER APPLY (SELECT TOP 1 PC.COD_CLT, PC.COD_ZON, PC.COD_TIP_DC, PC.CLASE_DOCUMENTO
                        FROM COAGRO2.erpadmin.alCXC_PEN_COB PC
                       WHERE PC.NUM_DOC = D.NUM_DOC
                       ORDER BY CASE WHEN PC.COD_CIA = :codCia THEN 0 ELSE 1 END, PC.COD_ZON) P
         OUTER APPLY (SELECT TOP 1 HF.COD_CLT, HF.COD_ZON
                        FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC HF
                       WHERE P.COD_CLT IS NULL AND HF.NUM_FAC = D.NUM_DOC
                       ORDER BY CASE WHEN HF.COD_CIA = :codCia THEN 0 ELSE 1 END, HF.COD_ZON) F
         OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                       WHERE COD_CLT = COALESCE(P.COD_CLT, F.COD_CLT)) CL
        WHERE D.NUM_DEP = :numDep AND D.CTA_BCO = :ctaBco
        ORDER BY D.NUM_DOC`,
      {
        replacements: { numDep: encabezado.NUM_DEP, ctaBco: encabezado.CTA_BCO, codCia: encabezado.COD_CIA },
        type: QueryTypes.SELECT,
      }
    );

    res.send({ result: { ...encabezado, lineas }, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar el deposito"] });
  }
};

module.exports = { getDepositos, getDeposito };
