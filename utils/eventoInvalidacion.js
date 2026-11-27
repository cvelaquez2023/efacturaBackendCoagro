/**
 * Evento de invalidación: archivo del evento (JSON) y representación gráfica
 * (PDF) que la Normativa DTE v2.0 obliga a entregar al receptor.
 *
 * Se guardan junto a los demás archivos de la empresa:
 *   storage/json/<esquema>/invalidaciones/<año>/<numeroControlDte>.json
 *   storage/pdf/<esquema>/invalidaciones/<año>/<numeroControlDte>.pdf
 * El nombre es el número de control del DTE invalidado, para ubicarlo fácil.
 */
const fs = require("fs");
const path = require("path");
const hbs = require("handlebars");
const { toString } = require("qrcode");
const { generatePdfWithPuppeteer, getLogoBase64 } = require("./generaPdf");

// CAT-002
const TIPO_DTE = {
  "01": "Factura",
  "03": "Comprobante de crédito fiscal",
  "04": "Nota de remisión",
  "05": "Nota de crédito",
  "06": "Nota de débito",
  "07": "Comprobante de retención",
  "08": "Comprobante de liquidación",
  "09": "Documento contable de liquidación",
  "11": "Factura de exportación",
  "14": "Factura de sujeto excluido",
  "15": "Comprobante de donación",
};
// CAT-024
const TIPO_ANULACION = {
  1: "1 - Error en la información del Documento Tributario Electrónico a invalidar",
  2: "2 - Rescindir de la operación realizada",
  3: "3 - Otro",
};
// CAT-022
const TIPO_DOCUMENTO = {
  "36": "NIT",
  "13": "DUI",
  "02": "Carnet de residente",
  "03": "Pasaporte",
  "37": "Otro",
};

const rutas = (esquema, ano, numeroControlDte) => ({
  json: path.join(__dirname, `../storage/json/${esquema}/invalidaciones/${ano}/${numeroControlDte}.json`),
  pdf: path.join(__dirname, `../storage/pdf/${esquema}/invalidaciones/${ano}/${numeroControlDte}.pdf`),
});

const asegurarCarpeta = (archivo) => fs.mkdirSync(path.dirname(archivo), { recursive: true });

/**
 * Guarda el archivo del evento: el JSON transmitido, la firma, el sello de
 * recepción y la respuesta completa de Hacienda.
 */
const guardarJsonInvalidacion = ({ esquema, ano, numeroControlDte, evento, firma, respuestaMH }) => {
  const { json } = rutas(esquema, ano, numeroControlDte);
  asegurarCarpeta(json);
  const archivo = {
    ...evento,
    firmaElectronica: firma,
    selloRecibido: respuestaMH?.selloRecibido ?? null,
    respuestaMh: respuestaMH,
  };
  fs.writeFileSync(json, JSON.stringify(archivo));
  return json;
};

/** Representación gráfica del evento (template/invalidacion/index.html). */
const generaPdfInvalidacion = async ({ esquema, ano, numeroControlDte, evento, respuestaMH, empresa }) => {
  const { pdf } = rutas(esquema, ano, numeroControlDte);
  asegurarCarpeta(pdf);

  const { identificacion: id, emisor: em, documento: doc, motivo: mo } = evento;

  // QR a la consulta pública del DTE invalidado (ahí se ve su estado INVALIDADO)
  const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${id.ambiente}&codGen=${doc.codigoGeneracion}&fechaEmi=${doc.fecEmi}`;
  const qrSvg = await new Promise((resolve, reject) =>
    toString(qrUrl, { type: "svg" }, (err, data) => (err ? reject(err) : resolve(data)))
  );

  const html = fs
    .readFileSync(path.join(__dirname, "../template/invalidacion/index.html"), "utf-8")
    .replace("[QR CODE]", qrSvg);

  const obj = {
    logoUrl: getLogoBase64(empresa),
    codigoGeneracion: id.codigoGeneracion,
    selloRecibido: respuestaMH?.selloRecibido || "",
    version: id.version,
    fecEmi: id.fecEmi ?? id.fecAnula,
    horEmi: id.horEmi ?? id.horAnula,
    fhProcesamiento: respuestaMH?.fhProcesamiento || "",
    ambiente: id.ambiente === "01" ? "Producción" : "Pruebas",

    nombreEmisor: em.nombre,
    nitEmisor: em.nit,
    codEstableMH: em.codEstableMH,
    codPuntoVentaMH: em.codPuntoVentaMH,
    telefonoEmisor: em.telefono,
    correoEmisor: em.correo,

    nombreReceptor: doc.nombre || "",
    tipoDocumentoReceptor: TIPO_DOCUMENTO[doc.tipoDocumento] || "Documento",
    numDocumentoReceptor: doc.numDocumento || "",
    telefonoReceptor: doc.telefono || "",
    correoReceptor: doc.correo || "",

    tipoDte: TIPO_DTE[doc.tipoDte] || doc.tipoDte,
    numeroControlDte: doc.numeroControl,
    codigoGeneracionDte: doc.codigoGeneracion,
    selloRecibidoDte: doc.selloRecibido,
    fecEmiDte: doc.fecEmi,
    codigoGeneracionR: doc.codigoGeneracionR,

    tipoAnulacion: TIPO_ANULACION[Number(mo.tipoAnulacion)] || mo.tipoAnulacion,
    motivoAnulacion: mo.motivoAnulacion,
    nombreResponsable: mo.nombreResponsable,
    tipDocResponsable: TIPO_DOCUMENTO[mo.tipDocResponsable] || "Documento",
    numDocResponsable: mo.numDocResponsable,
    nombreSolicita: mo.nombreSolicita,
    tipDocSolicita: TIPO_DOCUMENTO[mo.tipDocSolicita] || "Documento",
    numDocSolicita: mo.numDocSolicita,
  };

  await generatePdfWithPuppeteer(hbs.compile(html)({ products: obj }), pdf);
  return pdf;
};

module.exports = { guardarJsonInvalidacion, generaPdfInvalidacion, rutasInvalidacion: rutas };
