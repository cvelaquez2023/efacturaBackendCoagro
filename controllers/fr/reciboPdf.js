//
// PDF del recibo de cobro, con el MISMO formato que imprime la app movil (Cobros > Pagar > Recibo).
// La plantilla es utils/reciboHtml.js (copia de facturacionRuteoMobile/recibo-web/recibo.js).
// Se genera al momento (no se guarda) y siempre lleva el logo de Coagro (template/logo.jpeg).
//
//   GET /fr/deposito/:consecDep/pdf[?numDoc=...]     (web, sesion normal, rol Admin o Fr)
//
// La app hace un recibo por documento pagado: una pagina por cada linea de alCXC_DET_DEP del
// deposito. Con ?numDoc solo sale la pagina de ese documento.
//
// Tablas:
//   - erpadmin.alCXC_ENC_DEP      -> encabezado (CONSEC_DEP; NUM_DEP = numero de recibo)
//   - erpadmin.alCXC_DET_DEP      -> lineas (NUM_DEP + CTA_BCO), montos por forma de pago y REF
//   - erpadmin.alCXC_CTA_BCO      -> NOM_CTA
//   - erpadmin.alCXC_PEN_COB      -> cliente, ruta y saldo del documento
//   - erpadmin.alFAC_ENC_HIST_FAC -> respaldo de cliente/ruta si el documento ya se cancelo
//   - erpadmin.cliente            -> NOM_CLT
//   - erpadmin.RUTA_ASIGNADA_RT + AGENTE_ASOC_RT + AGENTE_RT -> tecnico (agente de la ruta del documento)
//
// Lo que no esta en las tablas de deposito:
//  - Tecnico: AGENTE (codigo de ruteo) y nombre del agente de la ruta del documento, como en la app;
//    sin agente, la ruta.
//  - Saldo anterior / pendiente: la app los guarda en el telefono, no en el servidor. Se reconstruyen
//    como hace la app con los recibos pendientes: saldo actual en PEN_COB (SALDO_DOLAR o SALDO_LOCAL
//    segun IND_MON del recibo) menos los recibos pendientes ANTERIORES (CONSEC_DEP menor) del mismo
//    documento. Solo si el recibo sigue pendiente (DOC_PRO 'N') y el documento esta en PEN_COB; si
//    control ya lo aplico, PEN_COB ya refleja este y otros pagos y no se puede saber: van null (no
//    salen esas filas y el estado queda ABONO, igual que la plantilla sin saldos).
//
// Respuesta: application/pdf (inline). Si no existe o falla: JSON { result: {}, success: false, errors }.

const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { generatePdfWithPuppeteer } = require("../../utils/generaPdf");
const { htmlRecibo, reciboDesdeServidor } = require("../../utils/reciboHtml");

const LOGO = path.join(__dirname, "../../template/logo.jpeg");
// Margenes del @page de la plantilla (16mm 12mm): generatePdfWithPuppeteer trae otros por defecto.
const MARGENES = { margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } };

let logo;
const logoBase64 = () => {
  if (!logo) logo = `data:image/jpeg;base64,${fs.readFileSync(LOGO).toString("base64")}`;
  return logo;
};

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());
const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });
const pagado = (alias) =>
  `ISNULL(${alias}.MON_EFE, 0) + ISNULL(${alias}.MON_CHE, 0) + ISNULL(${alias}.MON_DEP, 0) + ISNULL(${alias}.MON_TRA, 0)`;

const buscarRecibo = async (consecDep, numDoc) => {
  const [encabezado] = await sequelize.query(
    `SELECT E.CONSEC_DEP, LTRIM(RTRIM(E.NUM_DEP)) AS NUM_DEP, LTRIM(RTRIM(E.COD_CIA)) AS COD_CIA,
            LTRIM(RTRIM(E.CTA_BCO)) AS CTA_BCO, LTRIM(RTRIM(C.NOM_CTA)) AS NOM_CTA,
            CONVERT(varchar(19), E.FEC_DEP, 120) AS FEC_DEP, LTRIM(RTRIM(E.IND_MON)) AS IND_MON,
            LTRIM(RTRIM(E.NOTAS)) AS NOTAS, ISNULL(LTRIM(RTRIM(E.DOC_PRO)), 'N') AS DOC_PRO
       FROM COAGRO2.erpadmin.alCXC_ENC_DEP E
       LEFT JOIN COAGRO2.erpadmin.alCXC_CTA_BCO C
         ON C.COD_CIA = E.COD_CIA AND C.COD_BCO = E.COD_BCO AND C.CTA_BCO = E.CTA_BCO
      WHERE E.CONSEC_DEP = :consecDep`,
    { replacements: { consecDep }, type: QueryTypes.SELECT }
  );
  if (!encabezado) return null;

  const lineas = await sequelize.query(
    `SELECT LTRIM(RTRIM(D.NUM_DOC)) AS NUM_DOC, D.MON_EFE, D.MON_CHE, D.MON_TRA, D.MON_DEP,
            LTRIM(RTRIM(D.REF)) AS REF,
            LTRIM(RTRIM(COALESCE(P.COD_CLT, F.COD_CLT))) AS COD_CLT, LTRIM(RTRIM(CL.NOM_CLT)) AS NOM_CLT,
            LTRIM(RTRIM(COALESCE(P.COD_ZON, F.COD_ZON))) AS COD_ZON,
            LTRIM(RTRIM(A.AGENTE)) AS AGENTE, LTRIM(RTRIM(A.NOMBRE)) AS NOMBRE_AGENTE,
            CASE WHEN :indMon = 'D' THEN P.SALDO_DOLAR ELSE P.SALDO_LOCAL END AS SALDO_ACTUAL,
            ISNULL(X.PREVIO, 0) AS PAGOS_PENDIENTES_PREVIOS
       FROM COAGRO2.erpadmin.alCXC_DET_DEP D
       OUTER APPLY (SELECT TOP 1 PC.COD_CLT, PC.COD_ZON, PC.SALDO_DOLAR, PC.SALDO_LOCAL
                      FROM COAGRO2.erpadmin.alCXC_PEN_COB PC
                     WHERE PC.NUM_DOC = D.NUM_DOC
                     ORDER BY CASE WHEN PC.COD_CIA = :codCia THEN 0 ELSE 1 END, PC.COD_ZON) P
       OUTER APPLY (SELECT TOP 1 HF.COD_CLT, HF.COD_ZON
                      FROM COAGRO2.erpadmin.alFAC_ENC_HIST_FAC HF
                     WHERE P.COD_CLT IS NULL AND HF.NUM_FAC = D.NUM_DOC
                     ORDER BY CASE WHEN HF.COD_CIA = :codCia THEN 0 ELSE 1 END, HF.COD_ZON) F
       OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                     WHERE COD_CLT = COALESCE(P.COD_CLT, F.COD_CLT)) CL
       OUTER APPLY (SELECT TOP 1 RA.AGENTE, AR.NOMBRE
                      FROM COAGRO2.erpadmin.RUTA_ASIGNADA_RT RA
                      LEFT JOIN COAGRO2.erpadmin.AGENTE_ASOC_RT AA ON AA.CODIGO = RA.AGENTE
                      LEFT JOIN COAGRO2.erpadmin.AGENTE_RT AR ON AR.AGENTE = AA.AGENTE
                     WHERE RA.RUTA = COALESCE(P.COD_ZON, F.COD_ZON) AND RA.ACTIVA = 'S') A
       -- Recibos pendientes anteriores a este del mismo documento (la app ya los desconto del saldo).
       OUTER APPLY (SELECT SUM(${pagado("D2")}) AS PREVIO
                      FROM COAGRO2.erpadmin.alCXC_DET_DEP D2
                      JOIN COAGRO2.erpadmin.alCXC_ENC_DEP E2 ON E2.NUM_DEP = D2.NUM_DEP AND E2.CTA_BCO = D2.CTA_BCO
                     WHERE D2.NUM_DOC = D.NUM_DOC AND ISNULL(E2.DOC_PRO, 'N') = 'N'
                       AND E2.CONSEC_DEP < :consecDep) X
      WHERE D.NUM_DEP = :numDep AND D.CTA_BCO = :ctaBco
        ${numDoc ? "AND D.NUM_DOC = :numDoc" : ""}
      ORDER BY D.NUM_DOC`,
    {
      replacements: {
        consecDep,
        numDoc,
        numDep: encabezado.NUM_DEP,
        ctaBco: encabezado.CTA_BCO,
        codCia: encabezado.COD_CIA,
        indMon: encabezado.IND_MON === "D" ? "D" : "L",
      },
      type: QueryTypes.SELECT,
    }
  );
  return { encabezado, lineas };
};

const reciboDeLinea = (enc, l) => {
  const conSaldo = enc.DOC_PRO === "N" && l.SALDO_ACTUAL !== null && l.SALDO_ACTUAL !== undefined;
  const monto = Number(l.MON_EFE || 0) + Number(l.MON_CHE || 0) + Number(l.MON_TRA || 0) + Number(l.MON_DEP || 0);
  const saldoAnterior = conSaldo
    ? Math.round((Number(l.SALDO_ACTUAL) - Number(l.PAGOS_PENDIENTES_PREVIOS)) * 100) / 100
    : null;
  return reciboDesdeServidor(enc, l, {
    cliente: texto(l.COD_CLT),
    nombreCliente: texto(l.NOM_CLT) || texto(l.COD_CLT),
    tecnico: texto(l.AGENTE) || texto(l.COD_ZON),
    nombreTecnico: texto(l.NOMBRE_AGENTE),
    nombreCuenta: texto(enc.NOM_CTA),
    saldoAnterior,
    saldoNuevo: conSaldo ? Math.round((saldoAnterior - monto) * 100) / 100 : null,
  });
};

// htmlRecibo devuelve un documento completo; con varias lineas se usa el <head> (estilos) del
// primero y cada <body> va en su propia pagina.
const unirPaginas = (htmls) => {
  if (htmls.length === 1) return htmls[0];
  const cabeza = htmls[0].slice(0, htmls[0].indexOf("<body>"));
  const cuerpo = (h) => h.slice(h.indexOf("<body>") + 6, h.lastIndexOf("</body>"));
  return `${cabeza.replace("</head>", "<style>.pagina + .pagina { page-break-before: always; }</style></head>")}
<body>${htmls.map((h) => `<section class="pagina">${cuerpo(h)}</section>`).join("")}</body>
</html>`;
};

// GET /fr/deposito/:consecDep/pdf
const getReciboPdf = async (req, res) => {
  try {
    const consecDep = texto(req.params.consecDep);
    if (!/^\d+$/.test(consecDep)) return error(res, "consecDep debe ser un numero");
    const numDoc = texto(req.query.numDoc);

    const recibo = await buscarRecibo(Number(consecDep), numDoc);
    if (!recibo) return error(res, `No existe el deposito ${consecDep}`);
    if (!recibo.lineas.length) {
      return error(
        res,
        numDoc ? `El deposito ${consecDep} no tiene el documento ${numDoc}` : `El deposito ${consecDep} no tiene lineas`
      );
    }

    const opciones = { logo: logoBase64() };
    const html = unirPaginas(recibo.lineas.map((l) => htmlRecibo(reciboDeLinea(recibo.encabezado, l), opciones)));
    const pdf = await generatePdfWithPuppeteer(html, undefined, MARGENES);

    const nombre = `Recibo_${recibo.encabezado.NUM_DEP}${numDoc ? `_${numDoc}` : ""}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombre.replace(/[^\w.-]/g, "_")}"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF del recibo");
  }
};

module.exports = { getReciboPdf, reciboDeLinea, unirPaginas };
