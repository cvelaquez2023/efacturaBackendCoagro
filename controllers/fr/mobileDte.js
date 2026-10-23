//
// PDF de un DTE para la app movil (handheld).
//
// GET /fr/mobile/dte/:dte/pdf   (header Authorization: Bearer <token movil>, rol RUTA)
//   :dte = numero interno, ej. DTE-03-M001P001-26-000000000008555
//
// Genera el PDF con los mismos generadores que POST /envioMH/reimprimir (misma
// plantilla que la web) y lo devuelve en la misma respuesta (application/pdf).
// Solo se permiten DTE de clientes asignados (RUTA_CLIENTE) a las rutas de la
// handheld del token.
//
// Si falla responde JSON { result, success: false, errors: [mensaje] }.

const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { Sqlempresa } = require("../../sqltx/sql");
const { generaPdf, generaPdf05 } = require("../../utils/generaPdf");
const { generaPdfTicket } = require("../../utils/pdfMakeTicket");
const { numeroControl } = require("../../utils/numeroControl");

// DTE-<tipo>-<8 caracteres>-<año 2 digitos>-<correlativo>
const FORMATO_DTE = /^DTE-(\d{2})-[A-Z0-9]{8}-(\d{2})-\d{15}$/i;
// 01 consumidor final, 03 credito fiscal, 05 nota de credito, 11 exportacion
const TIPOS_PDF = ["01", "03", "05", "11"];

// Los generadores no guardan todos en el mismo lugar:
//  - generaPdf (Puppeteer) usa la carpeta del backend: <backend>/storage/pdf/...
//  - generaPdf05 y generaPdfTicket usan una ruta relativa a la carpeta de arranque:
//    ../backend/storage/pdf/... (es la misma si la carpeta del backend se llama "backend").
const RAIZ_BACKEND = path.join(__dirname, "../..");
const RAIZ_RELATIVA = () => path.resolve(process.cwd(), "../backend");

const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

const getDtePdf = async (req, res) => {
  try {
    const dte = String(req.params.dte || "").trim().toUpperCase();
    const partes = FORMATO_DTE.exec(dte);
    if (!partes) return error(res, "El numero de DTE no es valido");
    const tipo = partes[1];
    const ano = "20" + partes[2];
    if (!TIPOS_PDF.includes(tipo)) return error(res, `No se imprime este tipo de documento (${tipo})`);

    const empresaId = req.mobile.usuario.empresa;
    const [empresa] = await Sqlempresa(empresaId);
    if (!empresa || !/^\w+$/.test(empresa.esquemaBD || "")) {
      return error(res, "La empresa del usuario no esta activa");
    }

    // 1) El DTE existe para la empresa
    const [doc] = await sequelize.query(
      `SELECT Dte_Id FROM dte.dbo.dtes WHERE Dte = :dte AND Empresa_id = :empresa`,
      { replacements: { dte, empresa: empresaId }, type: QueryTypes.SELECT }
    );
    if (!doc) return error(res, `No existe el documento ${dte}`);

    // 2) Su cliente esta en una ruta de la handheld
    const [permitido] = await sequelize.query(
      `SELECT TOP 1 rc.CLIENTE
         FROM COAGRO2.${empresa.esquemaBD}.DOCUMENTOS_CC dc
         JOIN COAGRO2.erpadmin.RUTA_CLIENTE rc ON rc.CLIENTE = dc.CLIENTE
        WHERE dc.DOCUMENTO = :dte AND rc.RUTA IN (:rutas)`,
      { replacements: { dte, rutas: req.mobile.codigosRuta }, type: QueryTypes.SELECT }
    );
    if (!permitido) return error(res, "Este documento no es de un cliente de tus rutas");

    // 3) Generar con el mismo criterio que reimprimir y saber donde queda el archivo
    let generar;
    let raiz;
    let carpeta = `dte${tipo}`;
    if (tipo === "05") {
      generar = generaPdf05;
      raiz = RAIZ_RELATIVA();
    } else if (empresa.formato === "T") {
      generar = generaPdfTicket;
      raiz = RAIZ_RELATIVA();
      carpeta = tipo === "03" ? "dte03" : "dte01";
    } else {
      generar = generaPdf;
      raiz = RAIZ_BACKEND;
    }
    const archivo = path.join(
      raiz,
      "storage",
      "pdf",
      empresa.esquemaBD,
      carpeta,
      ano,
      `${numeroControl(dte)}.pdf`
    );
    fs.mkdirSync(path.dirname(archivo), { recursive: true });

    await generar(dte, ano, empresaId);
    if (!fs.existsSync(archivo)) return error(res, "No se pudo generar el PDF del documento");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${numeroControl(dte)}.pdf"`);
    res.sendFile(archivo);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al generar el PDF del documento");
  }
};

module.exports = { getDtePdf };
