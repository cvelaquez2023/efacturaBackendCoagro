//
// PDF del recibo de cobro, con el MISMO formato que imprime la app movil (Cobros > Pagar > Recibo).
// La plantilla es utils/reciboHtml.js (copia de facturacionRuteoMobile/recibo-web/recibo.js).
// Se genera al momento (no se guarda) y siempre lleva el logo de Coagro (template/logo.jpeg).
//
//   GET /fr/deposito/:consecDep/pdf[?numDoc=...]     (web, sesion normal, rol Admin o Fr)
//   GET /fr/mobile/recibo/:numDep/pdf[?ctaBco=...&numDoc=...]
//                                                    (app, token movil, rol RUTA: solo rutas de la handheld)
//
// La app no conoce CONSEC_DEP: busca por NUM_DEP (numero de recibo) y CTA_BCO; sin CTA_BCO y con
// varios depositos con ese NUM_DEP toma el mayor CONSEC_DEP. Si alguna linea del recibo es de una
// ruta que no es de la handheld (COD_ZON de PEN_COB / HIST_FAC), responde "No existe el recibo X en
// tus rutas", sin revelar que existe.
//
// Varias cuentas: si el cliente abona a mas de un banco (p. ej. transferencia al Agricola y deposito
// al Hipotecario), la app manda un deposito por cuenta con el MISMO NUM_DEP. Aqui se juntan: pidiendo
// cualquiera de las partes (CONSEC_DEP o ctaBco) sale el recibo completo, con todas las cuentas.
//
// La app hace un recibo por documento pagado: una pagina por documento, con lo pagado en todas las
// cuentas del recibo. Con ?numDoc solo sale la pagina de ese documento.
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
//    segun IND_MON del recibo) menos los recibos pendientes ANTERIORES del mismo documento (los que
//    tienen su primera parte con CONSEC_DEP menor; las otras partes de ESTE recibo no son anteriores:
//    se suman a lo pagado). Solo si todas las partes siguen pendientes (DOC_PRO 'N') y el documento esta en PEN_COB; si
//    control ya lo aplico, PEN_COB ya refleja este y otros pagos y no se puede saber: van null (no
//    salen esas filas y el estado queda ABONO, igual que la plantilla sin saldos).
//
// Respuesta: application/pdf (inline). Si no existe o falla: JSON { result: {}, success: false, errors }.

const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { generatePdfWithPuppeteer } = require("../../utils/generaPdf");
const { htmlRecibo, reciboDesdeServidor, formasDeLinea } = require("../../utils/reciboHtml");

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

// Un recibo abonado a varias cuentas se guarda como un deposito por cuenta, todos con el mismo
// NUM_DEP (y COD_CIA): son las "partes" del recibo. Se buscan todas a partir de cualquiera de ellas.
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

  const partes = await sequelize.query(
    `SELECT E.CONSEC_DEP, LTRIM(RTRIM(E.CTA_BCO)) AS CTA_BCO, LTRIM(RTRIM(C.NOM_CTA)) AS NOM_CTA,
            ISNULL(LTRIM(RTRIM(E.DOC_PRO)), 'N') AS DOC_PRO
       FROM COAGRO2.erpadmin.alCXC_ENC_DEP E
       LEFT JOIN COAGRO2.erpadmin.alCXC_CTA_BCO C
         ON C.COD_CIA = E.COD_CIA AND C.COD_BCO = E.COD_BCO AND C.CTA_BCO = E.CTA_BCO
      WHERE E.NUM_DEP = :numDep AND E.COD_CIA = :codCia
      ORDER BY E.CONSEC_DEP`,
    { replacements: { numDep: encabezado.NUM_DEP, codCia: encabezado.COD_CIA }, type: QueryTypes.SELECT }
  );

  const lineas = await sequelize.query(
    `SELECT LTRIM(RTRIM(D.CTA_BCO)) AS CTA_BCO, LTRIM(RTRIM(D.NUM_DOC)) AS NUM_DOC,
            D.MON_EFE, D.MON_CHE, D.MON_TRA, D.MON_DEP, LTRIM(RTRIM(D.REF)) AS REF,
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
       -- Recibos pendientes ANTERIORES a este del mismo documento (la app ya los desconto del saldo).
       -- Las otras partes de este recibo no cuentan. Un recibo es anterior si su primera parte
       -- (MIN CONSEC_DEP) es anterior a la primera de este: asi no importa si alguna parte se reenvio
       -- despues.
       OUTER APPLY (SELECT SUM(${pagado("D2")}) AS PREVIO
                      FROM COAGRO2.erpadmin.alCXC_DET_DEP D2
                      JOIN COAGRO2.erpadmin.alCXC_ENC_DEP E2 ON E2.NUM_DEP = D2.NUM_DEP AND E2.CTA_BCO = D2.CTA_BCO
                     WHERE D2.NUM_DOC = D.NUM_DOC AND ISNULL(E2.DOC_PRO, 'N') = 'N'
                       AND NOT (E2.NUM_DEP = :numDep AND E2.COD_CIA = :codCia)
                       AND (SELECT MIN(E3.CONSEC_DEP) FROM COAGRO2.erpadmin.alCXC_ENC_DEP E3
                             WHERE E3.NUM_DEP = E2.NUM_DEP AND E3.COD_CIA = E2.COD_CIA) < :primerConsec) X
      WHERE D.NUM_DEP = :numDep AND D.CTA_BCO IN (:ctas)
        ${numDoc ? "AND D.NUM_DOC = :numDoc" : ""}
      ORDER BY D.NUM_DOC`,
    {
      replacements: {
        numDoc,
        numDep: encabezado.NUM_DEP,
        ctas: partes.map((p) => p.CTA_BCO),
        codCia: encabezado.COD_CIA,
        primerConsec: partes[0].CONSEC_DEP,
        indMon: encabezado.IND_MON === "D" ? "D" : "L",
      },
      type: QueryTypes.SELECT,
    }
  );

  // Una entrada por documento con sus lineas de cada cuenta, en el orden de las partes.
  const orden = new Map(partes.map((p, i) => [p.CTA_BCO, i]));
  const documentos = new Map();
  for (const l of lineas) {
    if (!documentos.has(l.NUM_DOC)) documentos.set(l.NUM_DOC, []);
    documentos.get(l.NUM_DOC).push(l);
  }
  for (const ls of documentos.values()) ls.sort((a, b) => orden.get(a.CTA_BCO) - orden.get(b.CTA_BCO));

  return { encabezado, partes, lineas, documentos: [...documentos.values()] };
};

const totalLinea = (l) =>
  Number(l.MON_EFE || 0) + Number(l.MON_CHE || 0) + Number(l.MON_TRA || 0) + Number(l.MON_DEP || 0);
const redondear = (n) => Math.round(n * 100) / 100;

// Recibo (objeto de utils/reciboHtml.js) de un documento. lineasDoc: sus lineas de alCXC_DET_DEP, una
// por cuenta. Con varias cuentas se suman las formas de pago de todas, cada una con su cuenta, y la
// plantilla las lista en "Cuenta" (r.cuentas).
const reciboDeDocumento = (recibo, lineasDoc) => {
  const enc = recibo.encabezado;
  const [l] = lineasDoc;
  const parte = (cta) => recibo.partes.find((p) => p.CTA_BCO === cta) || {};
  const nombreCuenta = (cta) => texto(parte(cta).NOM_CTA);
  const varias = lineasDoc.length > 1;

  const formas = lineasDoc.flatMap((x) =>
    formasDeLinea(x).map((f) => (varias ? { ...f, cuentaDeposito: nombreCuenta(x.CTA_BCO) || x.CTA_BCO } : f))
  );
  const monto = redondear(lineasDoc.reduce((s, x) => s + totalLinea(x), 0));

  // Saldos solo si ninguna parte la aplico control todavia.
  const conSaldo =
    recibo.partes.every((p) => p.DOC_PRO === "N") && l.SALDO_ACTUAL !== null && l.SALDO_ACTUAL !== undefined;
  const saldoAnterior = conSaldo ? redondear(Number(l.SALDO_ACTUAL) - Number(l.PAGOS_PENDIENTES_PREVIOS)) : null;

  const r = reciboDesdeServidor({ ...enc, CTA_BCO: l.CTA_BCO }, l, {
    cliente: texto(l.COD_CLT),
    nombreCliente: texto(l.NOM_CLT) || texto(l.COD_CLT),
    tecnico: texto(l.AGENTE) || texto(l.COD_ZON),
    nombreTecnico: texto(l.NOMBRE_AGENTE),
    nombreCuenta: nombreCuenta(l.CTA_BCO),
    saldoAnterior,
    saldoNuevo: conSaldo ? redondear(saldoAnterior - monto) : null,
  });
  if (!varias) return r;
  return {
    ...r,
    formas,
    monto,
    cuentas: lineasDoc.map((x) => ({
      cuenta: x.CTA_BCO,
      nombreCuenta: nombreCuenta(x.CTA_BCO),
      monto: redondear(totalLinea(x)),
    })),
  };
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

// Arma el PDF (una pagina por linea) y lo responde inline. Comun a la web y a la app.
const enviarPdfRecibo = async (res, recibo, numDoc) => {
  const opciones = { logo: logoBase64() };
  const html = unirPaginas(recibo.documentos.map((ls) => htmlRecibo(reciboDeDocumento(recibo, ls), opciones)));
  const pdf = await generatePdfWithPuppeteer(html, undefined, MARGENES);

  const nombre = `Recibo_${recibo.encabezado.NUM_DEP}${numDoc ? `_${numDoc}` : ""}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${nombre.replace(/[^\w.-]/g, "_")}"`);
  res.send(Buffer.from(pdf));
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
    await enviarPdfRecibo(res, recibo, numDoc);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF del recibo");
  }
};

// GET /fr/mobile/recibo/:numDep/pdf[?ctaBco=...&numDoc=...]
// La app no conoce CONSEC_DEP (IDENTITY del servidor): se busca por NUM_DEP (+ CTA_BCO si viene;
// sin ella y con varios, el mayor CONSEC_DEP; con varias cuentas del mismo recibo cualquiera da el
// recibo completo). Solo recibos de las rutas de la handheld: si alguna
// linea es de otra ruta (o no se sabe de cual) responde igual que si no existiera.
const getReciboPdfMovil = async (req, res) => {
  try {
    const numDep = texto(req.params.numDep);
    const ctaBco = texto(req.query.ctaBco);
    const numDoc = texto(req.query.numDoc);
    if (!numDep) return error(res, "El numero de recibo es obligatorio");
    const noExiste = () => error(res, `No existe el recibo ${numDep} en tus rutas`);

    const [deposito] = await sequelize.query(
      `SELECT TOP 1 CONSEC_DEP
         FROM COAGRO2.erpadmin.alCXC_ENC_DEP
        WHERE LTRIM(RTRIM(NUM_DEP)) = :numDep
          ${ctaBco ? "AND LTRIM(RTRIM(CTA_BCO)) = :ctaBco" : ""}
        ORDER BY CONSEC_DEP DESC`,
      { replacements: { numDep, ctaBco }, type: QueryTypes.SELECT }
    );
    if (!deposito) return noExiste();

    const recibo = await buscarRecibo(deposito.CONSEC_DEP, numDoc);
    if (!recibo || !recibo.lineas.length) return noExiste();
    const rutas = new Set((req.mobile.codigosRuta || []).map(texto));
    if (recibo.lineas.some((l) => !rutas.has(texto(l.COD_ZON)))) return noExiste();

    await enviarPdfRecibo(res, recibo, numDoc);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF del recibo");
  }
};

module.exports = { getReciboPdf, getReciboPdfMovil, reciboDeDocumento, unirPaginas };
