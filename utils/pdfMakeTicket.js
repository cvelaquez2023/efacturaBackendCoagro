const fs = require("fs");
const path = require("path");
const pdf = require("pdf-creator-node");
const moment = require("moment-timezone");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { Sqlempresa } = require("../sqltx/sql");
const { toString } = require("qrcode");

const fmt = (value = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const options = {
  width: "80mm",
  orientation: "portrait",
  header: { height: "0mm" },
  footer: { height: "0mm" },
  border: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
};

const generaPdfTicket = async (factura, _ano, empresa_id) => {
  const empresa = await Sqlempresa(empresa_id);
  console.log("Generando ticket PDF para factura:", factura, "Empresa:", empresa[0].nombre);
  const _dte = await sequelize.query(
    `SELECT Dte_Id, Dte, tipoDoc, CONVERT(nvarchar, fechaemision, 120) as fechaProce,
     CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,
     codigoGeneracion, selloRecibido
     FROM dte.dbo.dtes WHERE dte='${factura}' AND Empresa_id='${empresa_id}'`,
    { type: QueryTypes.SELECT }
  );

  if (!_dte || _dte.length === 0) {
    console.log("DTE no encontrado para ticket:", factura);
    return;
  }

  const dteId = _dte[0].Dte_Id;

  const _receptor = await sequelize.query(
    `SELECT nit, nrc, nombre, descActividad, nombreComercial, direccion_compl, telefono, correo
     FROM dte.dbo.receptor WHERE dte_id=${dteId}`,
    { type: QueryTypes.SELECT }
  );

  const _linea = await sequelize.query(
    `SELECT fl.bodega, art.DESCRIPCION as nombre, cu.cantidad, cu.precioUni, cu.montoDescu,
     fl.PORC_DESC_LIN as porDesc, cu.ventaNoSuj + cu.ventaExenta + cu.ventaGravada as totalLinea,
     fl.lote, CONVERT(varchar, lo.FECHA_VENCIMIENTO, 105) as fechaVence
     FROM dte.dbo.cuerpoDocumento cu,
     dte.dbo.dtes dte,
     COAGRO2.cincoh.factura_Linea fl,
     COAGRO2.CINCOH.ARTICULO art,
     COAGRO2.CINCOH.lote lo
     WHERE cu.dte_id=${dteId} AND cu.dte_Id=dte.Dte_Id AND dte.Dte=fl.factura
     AND cu.numItem=fl.LINEA + 1 AND fl.articulo=art.articulo
     AND fl.articulo=lo.articulo AND fl.lote=lo.LOTE
     ORDER BY cu.numItem`,
    { type: QueryTypes.SELECT }
  );

  const _resumen = await sequelize.query(
    `SELECT totalNoSuj, totalExenta, totalGravada, subTotalVentas, totalDescu, subTotal,
     ivaPerci1, ivaRete1, reteRenta, montoTotalOperacion, totalPagar, totalLetras
     FROM dte.dbo.resumen WHERE dte_id=${dteId}`,
    { type: QueryTypes.SELECT }
  );

  const _iva = await sequelize.query(
    `SELECT valor FROM DTE.dbo.tributoresumen WHERE dte_Id=${dteId}`,
    { type: QueryTypes.SELECT }
  );

  let montoIva = 0;
  if (_iva.length > 0) {
    montoIva = _iva[0].valor;
  }

  const _Cliente = await sequelize.query(
    `SELECT VALOR FROM dte.dbo.apendice WHERE dte_Id=${dteId} AND campo='CLIENTE'`,
    { type: QueryTypes.SELECT }
  );

  const _Vendedor = await sequelize.query(
    `SELECT VALOR FROM dte.dbo.apendice WHERE dte_Id=${dteId} AND campo='VENDEDOR'`,
    { type: QueryTypes.SELECT }
  );

  const _Nombre = await sequelize.query(
    `SELECT VALOR FROM dte.dbo.apendice WHERE dte_Id=${dteId} AND campo='NOMBRE'`,
    { type: QueryTypes.SELECT }
  );

  const vendedor =
    (_Vendedor.length > 0 ? _Vendedor[0].VALOR : "") +
    "-" +
    (_Nombre.length > 0 ? _Nombre[0].VALOR : "");

  const _documento = await sequelize.query(
    `SELECT doc.DOCUMENTO as doc,
     CONVERT(varchar, doc.FECHA_DOCUMENTO, 105) as fechaDocumento,
     CONVERT(varchar, doc.FECHA_VENCE, 105) as fechaDocVence,
     doc.CONDICION_PAGO as condicionPago,
     cod.DIAS_NETO as diasNeto,
     cod.DESCRIPCION as formaPago
     FROM dte.dbo.dtes dte,
     COAGRO2.CINCOH.DOCUMENTOS_CC doc,
     COAGRO2.CINCOH.CONDICION_PAGO cod
     WHERE dte.Dte_Id=${dteId} AND dte.dte=doc.documento AND doc.condicion_pago=cod.condicion_pago`,
    { type: QueryTypes.SELECT }
  );

  const documentoData = _documento.length > 0 ? _documento[0] : {};
  const receptorData = _receptor.length > 0 ? _receptor[0] : {};
  const resumenData = _resumen.length > 0 ? _resumen[0] : {};

  const fechaQr = moment
    .tz(_dte[0].fechaProce, "America/El_Salvador")
    .format("YYYY-MM-DD");

  const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${process.env.DTE_AMBIENTE || "01"}&codGen=${_dte[0].codigoGeneracion}&fechaEmi=${fechaQr}`;

  const qrSvg = await new Promise((resolve, reject) => {
    toString(qrUrl, { type: "svg" }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });

  const logoPath = path.join(__dirname, "../template/logo.jpeg");
  let logoBase64 = "";
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = "data:image/jpeg;base64," + logoBuffer.toString("base64");
  }

  let templateHtml = fs.readFileSync(
    path.join(__dirname, "../template/ticket/index.html"),
    "utf-8"
  );

  templateHtml = templateHtml.replace("[QR CODE]", qrSvg);

  const tipoDocLabel =
    _dte[0].tipoDoc === "01"
      ? "COMPROBANTE CONSUMIDOR FINAL"
      : _dte[0].tipoDoc === "03"
      ? "COMPROBANTE CREDITO FISCAL"
      : "DOCUMENTO TRIBUTARIO ELECTRONICO";

  const numeroControl = _dte[0].Dte
    ? `${_dte[0].Dte.substring(0, 15)}-${_dte[0].Dte.substring(19, 34)}`
    : "";

  const esCredito = _dte[0].tipoDoc === "03";

  const prodlist = _linea.map((l, i) => {
    const precioUni = Number(l.precioUni);
    const porDesc = Number(l.porDesc || 0);
    const cantidad = Number(l.cantidad);
    const precioDesc = precioUni - (precioUni * porDesc) / 100;
    return {
      numItem: i + 1,
      codigo: "",
      cantidad: cantidad.toFixed(0),
      descripcion: l.nombre,
      precioUni: fmt(precioUni),
      porDesc: porDesc.toFixed(0),
      precioDescuento: fmt(precioDesc),
      montoDescu: fmt(Number(l.montoDescu)),
      ventaGravada: fmt(Number(l.totalLinea)),
      bodega: l.bodega || "",
      lote: l.lote || "-",
      fechaVence: l.fechaVence || "-",
    };
  });

  const obj = {
    logoUrl: logoBase64,
    tipoDoc: tipoDocLabel,
    codigoGeneracion: _dte[0].codigoGeneracion,
    selloRecibido: _dte[0].selloRecibido,
    numeroControl: numeroControl,
    fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,

    nombreEmisor: empresa[0].nombre,
    nitEmisor: empresa[0].nit,
    nrcEmisor: empresa[0].nrc,
    actividadEmisor: empresa[0].desActividad,
    direccionEmisor: empresa[0].complementoDir,
    telefonoEmisor: empresa[0].telefono,
    correoEmisor: empresa[0].correoDte,

    nombreReceptor: receptorData.nombre || "",
    nombreComercialReceptor: receptorData.nombreComercial || "",
    nitReceptor: receptorData.nit || "",
    nrcReceptor: receptorData.nrc || "",
    descActividadReceptor: receptorData.descActividad || "",
    direccionReceptor: receptorData.direccion_compl || "",
    telefonoReceptor: receptorData.telefono || "",
    correoReceptor: receptorData.correo || "",

    prodlist: prodlist,

    totalNoSuj: fmt(Number(resumenData.totalNoSuj || 0)),
    totalExenta: fmt(Number(resumenData.totalExenta || 0)),
    totalGravada: fmt(Number(resumenData.totalGravada || 0)),
    subTotalVentas: fmt(Number(resumenData.subTotalVentas || 0)),
    totalDescu: fmt(Number(resumenData.totalDescu || 0)),
    subTotal: fmt(Number(resumenData.subTotal || 0)),
    valorIva: fmt(Number(montoIva)),
    ivaPerci1: fmt(Number(resumenData.ivaPerci1 || 0)),
    ivaRete1: fmt(Number(resumenData.ivaRete1 || 0)),
    reteRenta: fmt(Number(resumenData.reteRenta || 0)),
    montoTotalOperacion: fmt(Number(resumenData.montoTotalOperacion || 0)),
    totalPagar: fmt(Number(resumenData.totalPagar || 0)),
    totalLetras: resumenData.totalLetras || "",

    vendedor: vendedor,
    formaPago: documentoData.formaPago || "-",
    diasCredito: documentoData.diasNeto || "-",
    esCredito: esCredito,
    fechaDocumento: documentoData.fechaDocumento || "",
    fechaDocVence: documentoData.fechaDocVence || "",
    cliente: _Cliente.length > 0 ? _Cliente[0].VALOR : "",
  };

  const dir = _dte[0].tipoDoc === "03" ? "dte03" : "dte01";
  const filename = factura.replace("-26-", "-");
  const filePdf = filename + ".pdf";
  const filePath = `../backend/storage/pdf/${empresa[0].esquemaBD}/${dir}/${_ano}/`;

  const document = {
    html: templateHtml,
    data: {
      products: obj,
    },
    path: filePath + filePdf,
  };

  await pdf
    .create(document, options)
    .then((res) => {
      console.log("Ticket PDF generado:", filePath + filePdf);
    })
    .catch((error) => {
      console.log("Error generando ticket PDF:", error);
    });
};

module.exports = { generaPdfTicket };
