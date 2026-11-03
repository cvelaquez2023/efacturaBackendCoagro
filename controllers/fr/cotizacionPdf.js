//
// PDF de una cotizacion (o pedido) de alFAC_ENC_PED + alFAC_DET_PED, generado al momento de pedirlo
// (no se guarda en storage). Siempre lleva el logo de Coagro (template/logo.jpeg).
//
//   GET /fr/pedido/:cia/:pedido/pdf                  (web, sesion normal, rol Admin o Fr)
//   GET /fr/mobile/cotizacion/:cia/:pedido/pdf       (app, token movil, rol RUTA: solo rutas de la handheld)
//
// Tablas:
//   - erpadmin.alFAC_ENC_PED -> encabezado (llave COD_CIA + NUM_PED)
//   - erpadmin.alFAC_DET_PED -> lineas, por NUM_LN
//   - erpadmin.cliente       -> nombre y direccion del cliente (COD_CLT)
//   - erpadmin.CLIENTE_CIA   -> contacto y telefono del cliente en la compania
//   - erpadmin.RUTA_RT       -> nombre de la ruta (RUTA = COD_ZON)
//   - erpadmin.ARTICULO      -> descripcion del articulo (COD_ART)
//   - dte.dbo.empresa        -> datos del emisor (nombre, NIT, NRC, direccion, telefono, correo)
//
// Respuesta: application/pdf (inline). Si no existe o no se puede generar: JSON
// { result: {}, success: false, errors: [mensaje] }, como el resto de endpoints.
//
// Notas:
//  - El titulo sale de TIP_DOC: 'C' = COTIZACION, cualquier otro = PEDIDO (una cotizacion aprobada
//    ya es pedido y se puede volver a imprimir).
//  - Totales del encabezado: subtotal MON_SIV, descuento MON_DSC, IVA MON_IMP_VT, total MON_CIV.

const fs = require("fs");
const path = require("path");
const hbs = require("handlebars");
const moment = require("moment");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { Sqlempresa } = require("../../sqltx/sql");
const { generatePdfWithPuppeteer } = require("../../utils/generaPdf");

const PLANTILLA = path.join(__dirname, "../../template/cotizacion.html");
const LOGO = path.join(__dirname, "../../template/logo.jpeg");

// Se leen una sola vez: la plantilla y el logo no cambian mientras corre el servidor.
let plantilla;
let logo;
const recursos = () => {
  if (!plantilla) plantilla = hbs.compile(fs.readFileSync(PLANTILLA, "utf8"));
  if (!logo) logo = `data:image/jpeg;base64,${fs.readFileSync(LOGO).toString("base64")}`;
  return { plantilla, logo };
};

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dinero = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(
    Number(v) || 0
  );
const cantidad = (v) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(v) || 0);

const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

// Busca el documento; con `rutas` solo lo devuelve si COD_ZON esta en ellas.
const buscarDocumento = async (cia, pedido, rutas) => {
  const replacements = { cia, pedido, rutas };
  const filtroRuta = rutas ? "AND P.COD_ZON IN (:rutas)" : "";
  const [[encabezado], lineas] = await Promise.all([
    sequelize.query(
      `SELECT P.COD_CIA, P.COD_ZON, P.COD_CLT, P.NUM_PED, P.TIP_DOC, P.COD_BOD, P.COD_CND, P.MONEDA,
              P.OBS_PED, P.DIR_ENT, P.MON_SIV, P.MON_DSC, P.MON_IMP_VT, P.MON_CIV,
              CONVERT(varchar(10), P.FEC_PED, 103) AS FEC_PED,
              CONVERT(varchar(10), P.FEC_DES, 103) AS FEC_DES,
              C.NOM_CLT, C.DIR_CLT, CC.NOM_CTO, CC.NUM_TEL, R.DESCRIPCION AS RUTA_DESCRIPCION
         FROM COAGRO2.erpadmin.alFAC_ENC_PED P
         OUTER APPLY (SELECT TOP 1 NOM_CLT, DIR_CLT FROM COAGRO2.erpadmin.cliente
                       WHERE COD_CLT = P.COD_CLT) C
         OUTER APPLY (SELECT TOP 1 NOM_CTO, NUM_TEL FROM COAGRO2.erpadmin.CLIENTE_CIA
                       WHERE COD_CLT = P.COD_CLT AND COD_CIA = P.COD_CIA) CC
         OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                       WHERE RUTA = P.COD_ZON) R
        WHERE P.COD_CIA = :cia AND P.NUM_PED = :pedido ${filtroRuta}`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT D.NUM_LN, D.COD_ART, D.CNT_MAX, D.MON_PRC_MX, D.MON_DSC, D.MON_TOT, D.ART_BON, A.DES_ART
         FROM COAGRO2.erpadmin.alFAC_DET_PED D
         OUTER APPLY (SELECT TOP 1 DES_ART FROM COAGRO2.erpadmin.ARTICULO
                       WHERE COD_ART = D.COD_ART) A
        WHERE D.COD_CIA = :cia AND D.NUM_PED = :pedido
        ORDER BY D.NUM_LN`,
      { replacements: { cia, pedido }, type: QueryTypes.SELECT }
    ),
  ]);
  return encabezado ? { encabezado, lineas } : null;
};

const armarPdf = async ({ encabezado: e, lineas }, empresaId) => {
  const [empresa] = await Sqlempresa(empresaId);
  const emp = empresa || {};
  const { plantilla, logo } = recursos();
  const ruta = texto(e.COD_ZON);
  const nombreRuta = texto(e.RUTA_DESCRIPCION);

  const html = plantilla({
    d: {
      logo,
      titulo: texto(e.TIP_DOC) === "C" ? "COTIZACIÓN" : "PEDIDO",
      numero: texto(e.NUM_PED),
      fecha: texto(e.FEC_PED),
      fechaEntrega: texto(e.FEC_DES),
      emisor: {
        nombre: texto(emp.nombreComercial) || texto(emp.nombre) || "COAGRO",
        nit: texto(emp.nit),
        nrc: texto(emp.nrc),
        direccion: texto(emp.complementoDir),
        telefono: texto(emp.telefono),
        correo: texto(emp.correoDte),
      },
      cliente: {
        codigo: texto(e.COD_CLT),
        nombre: texto(e.NOM_CLT) || texto(e.COD_CLT),
        contacto: texto(e.NOM_CTO),
        telefono: texto(e.NUM_TEL),
        direccion: texto(e.DIR_CLT),
      },
      ruta: nombreRuta ? `${ruta} - ${nombreRuta}` : ruta,
      condicionPago: texto(e.COD_CND),
      bodega: texto(e.COD_BOD),
      moneda: texto(e.MONEDA) || "USD",
      direccionEntrega: texto(e.DIR_ENT),
      observaciones: texto(e.OBS_PED),
      lineas: lineas.map((l, i) => ({
        numero: texto(l.NUM_LN) || i + 1,
        codigo: texto(l.COD_ART),
        descripcion: texto(l.DES_ART) || texto(l.COD_ART),
        bonificacion: ["S", "1"].includes(texto(l.ART_BON).toUpperCase()),
        cantidad: cantidad(l.CNT_MAX),
        precio: dinero(l.MON_PRC_MX),
        descuento: dinero(l.MON_DSC),
        total: dinero(l.MON_TOT),
      })),
      totales: {
        subtotal: dinero(e.MON_SIV),
        descuento: dinero(e.MON_DSC),
        impuesto: dinero(e.MON_IMP_VT),
        total: dinero(e.MON_CIV),
      },
      generado: moment().format("DD/MM/YYYY HH:mm"),
    },
  });
  return generatePdfWithPuppeteer(html);
};

const enviarPdf = async (res, cia, pedido, rutas, empresaId) => {
  if (!cia || !pedido) return error(res, "La compania y el numero de documento son obligatorios");
  const documento = await buscarDocumento(cia, pedido, rutas);
  if (!documento) return error(res, `No existe el documento ${pedido}${rutas ? " en tus rutas" : ""}`);

  const pdf = await armarPdf(documento, empresaId);
  const nombre = `${texto(documento.encabezado.TIP_DOC) === "C" ? "Cotizacion" : "Pedido"}_${pedido}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${nombre.replace(/[^\w.-]/g, "_")}"`);
  res.send(Buffer.from(pdf));
};

// GET /fr/pedido/:cia/:pedido/pdf
const getCotizacionPdf = async (req, res) => {
  try {
    await enviarPdf(res, texto(req.params.cia), texto(req.params.pedido), null, req.cliente[0].empresa);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF de la cotizacion");
  }
};

// GET /fr/mobile/cotizacion/:cia/:pedido/pdf
const getCotizacionPdfMovil = async (req, res) => {
  try {
    await enviarPdf(
      res,
      texto(req.params.cia),
      texto(req.params.pedido),
      req.mobile.codigosRuta,
      req.mobile.usuario.empresa
    );
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF de la cotizacion");
  }
};

module.exports = { getCotizacionPdf, getCotizacionPdfMovil };
