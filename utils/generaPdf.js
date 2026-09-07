const fs = require("fs");
const path = require("path");
const pdf = require("pdf-creator-node");
const puppeteer = require("puppeteer");
const hbs = require("handlebars");
const moment = require("moment");
const options = require("../config/options");
const rqcode = require("../template/rqcode");
const { toString } = require("qrcode");
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");
const { Sqlempresa } = require("../sqltx/sql");

const getLogoBase64 = (empresa) => {
  const logoPath = path.join(__dirname, "../template/logo.jpeg");
  if (fs.existsSync(logoPath)) {
    return "data:image/jpeg;base64," + fs.readFileSync(logoPath).toString("base64");
  }
  if (empresa && empresa[0] && empresa[0].logoUrl) {
    return empresa[0].logoUrl;
  }
  return "";
};

const findChromePath = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
  ];
  return paths.find((p) => fs.existsSync(p)) || null;
};

const generatePdfWithPuppeteer = async (htmlContent, outputPath) => {
  const chromePath = findChromePath();
  const launchOptions = { headless: "new" };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    margin: {
      top: "10mm",
      bottom: "13mm",
      left: "10mm",
      right: "10mm",
    },
  });
  await browser.close();
};

const generaPdf = async (datos, _ano, empresa_id) => {
  const filename = datos.replace("-26-", "-");
  const filePdf = datos.replace("-26-", "-") + ".pdf";

  const empresa = await Sqlempresa(empresa_id);

  const fmt = (value = 0) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const _dte = await sequelize.query(
    `select Dte_Id, tipoDoc,  CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,fechaemision ,codigoGeneracion,selloRecibido  from dte.dbo.dtes where  dte='${datos}' and Empresa_id='${empresa_id}' `,
    { type: QueryTypes.SELECT },
  );
  const _idDte = _dte[0].Dte_Id;
  // detalle de dte Cuerpo
  const _dteCuerpo = await sequelize.query(
    `SELECT fl.bodega, art.articulo as articulo , art.DESCRIPCION as nombre, cu.cantidad, cu.precioUni, cu.montoDescu,
     fl.PORC_DESC_LIN as porDesc, cu.ventaNoSuj + cu.ventaExenta + cu.ventaGravada as totalLinea,
     fl.lote, CONVERT(varchar, lo.FECHA_VENCIMIENTO, 105) as fechaVence
     FROM dte.dbo.cuerpoDocumento cu,
     dte.dbo.dtes dte,
     COAGRO2.${empresa[0].esquemaBD}.factura_Linea fl,
     COAGRO2.${empresa[0].esquemaBD}.ARTICULO art,
     COAGRO2.${empresa[0].esquemaBD}.lote lo
     WHERE cu.dte_id=${_idDte} AND cu.dte_Id=dte.Dte_Id AND dte.Dte=fl.factura
     AND cu.numItem=fl.LINEA + 1 AND fl.articulo=art.articulo
     AND fl.articulo=lo.articulo AND fl.lote=lo.LOTE
     ORDER BY cu.numItem
    `,
    { type: QueryTypes.SELECT },
  );
  const _dteReceptor = await sequelize.query(
    `select * from dte.dbo.receptor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteEmisior = await sequelize.query(
    `select * from dte.dbo.emisor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );

  const _dteResumen = await sequelize.query(
    `select * from dte.dbo.resumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteTributoResumen = await sequelize.query(
    `select * from dte.dbo.tributoresumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _apendice = await sequelize.query(
    `select * from dte.dbo.apendice where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _documento = await sequelize.query(
    `SELECT doc.CONDICION_PAGO as condicionPago,
            cod.DIAS_NETO as diasNeto,
            cod.DESCRIPCION as formaPago,
            CONVERT(varchar, doc.FECHA_VENCE, 105) as fechaPago
     FROM COAGRO2.${empresa[0].esquemaBD}.DOCUMENTOS_CC doc
     JOIN COAGRO2.${empresa[0].esquemaBD}.CONDICION_PAGO cod ON doc.condicion_pago=cod.condicion_pago
     WHERE doc.documento='${datos}'`,
    { type: QueryTypes.SELECT },
  );
  const documentoData = _documento.length > 0 ? _documento[0] : {};
  let ApVendedor = "";
  let ApNombreV = "";
  let ApObservaciones = "";
  let ApDescripcion = "";
  let ApCliente = "";
  let ApAlias = "";
  let ApPedido = "";
  let ApDirecion = "";
  let ApMunicipio = "";
  for (let y = 0; y < _apendice.length; y++) {
    const element = _apendice[y];
    if (element.campo == "VENDEDOR") {
      ApVendedor = element.valor;
    }
    if (element.campo == "NOMBRE") {
      ApNombreV = element.valor;
    }
    if (element.campo == "OBSERVACIONES") {
      ApObservaciones = element.valor;
    }
    if (element.campo == "DESCRIPCION") {
      ApDescripcion = element.valor;
    }
    if (element.campo == "CLIENTE") {
      ApCliente = element.valor;
    }
    if (element.campo == "ALIAS") {
      ApAlias = element.valor;
    }
    if (element.campo == "PEDIDO") {
      ApPedido = element.valor;
    }
    if (element.campo == "DIRECION") {
      ApDirecion = element.valor;
    }
    if (element.campo == "ZONA") {
      ApMunicipio = element.valor;
    }
  }
  let tributo = "";
  if (_dteTributoResumen.length > 0) {
    tributo = _dteTributoResumen[0].valor;
  } else {
    tributo = 0.0;
  }

  const datosQr = {
    fechaEmi: moment
      .tz(_dte[0].fechaemision, "America/El_Salvador")
      .format("YYYY-MM-DD"),
    codGen: _dte[0].codigoGeneracion,
    ambiente: process.env.DTE_AMBIENTE,
  };

  const htmlRaw = fs.readFileSync(
    path.join(__dirname, "../template/dte/index.html"),
    "utf-8",
  );

  const qrUrl1 = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datosQr.ambiente || "01"}&codGen=${datosQr.codGen}&fechaEmi=${datosQr.fechaEmi}`;
  const qrSvg1 = await new Promise((resolve, reject) => {
    toString(qrUrl1, { type: "svg" }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const html = htmlRaw.replace("[QR CODE]", qrSvg1);

  let array = [];
  let item = 0;

  const prodlist = _dteCuerpo.map((l, i) => {
    const precioUni = Number(l.precioUni);
    const porDesc = Number(l.porDesc || 0);
    const cantidad = Number(l.cantidad);
    const precioDesc = precioUni - (precioUni * porDesc) / 100;
    return {
      numItem: i + 1,
      codigo: l.articulo || "",
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

  let tipo,
    dir = "";
  if (_dte[0].tipoDoc === "03") {
    tipo = "COMPROBANTE CREDITO FISCAL";
    dir = "dte03";
  }
  if (_dte[0].tipoDoc === "01") {
    tipo = "COMPROBANTE CONSUMIDOR FINAL";
    dir = "dte01";
  }
  if (_dte[0].tipoDoc === "05") {
    tipo = "COMPROBANTE NOTA DE CREDITO";
    dir = "dte05";
  }
  if (_dte[0].tipoDoc === "11") {
    tipo = "COMPROBANTE DE EXPORTACION";
    dir = "dte11";
  }
  const obj = {
    logoUrl: getLogoBase64(empresa),
    tipoDoc: tipo,
    codigoGeneracion: _dte[0].codigoGeneracion,
    numeroControl: filename,
    selloRecibido: _dte[0].selloRecibido,
    fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,
    fechaGeneracion: _dte[0].fecha,
    horaGeneracion: _dte[0].hora,
    nombreEmisor: _dteEmisior[0].nombre,
    nitEmisor: _dteEmisior[0].nit,
    nrcEmisor: _dteEmisior[0].nrc,
    actividadEmisor: _dteEmisior[0].descActividad,
    direccionEmisor: _dteEmisior[0].direccion_compl,
    telefonoEmisor: _dteEmisior[0].telefono,
    correoEmisor: _dteEmisior[0].correo,
    nombreComercialEmisor: _dteEmisior[0].nombreComercial,
    nombre: _dteReceptor[0].nombre,
    nombreComercial: _dteReceptor[0].nombreComercial,
    nit: _dteReceptor[0].nit,
    nrc: _dteReceptor[0].nrc,
    descActividad: _dteReceptor[0].descActividad,
    direccion_compl: _dteReceptor[0].direccion_compl,
    telefono: _dteReceptor[0].telefono,
    correo: _dteReceptor[0].correo,
    prodlist: prodlist,
    totalNoSuj: _dteResumen[0].totalNoSuj.toFixed(2),
    totalExenta: _dteResumen[0].totalExenta.toFixed(2),
    totalGravada: _dteResumen[0].totalGravada.toFixed(2),
    totalDescu: _dteResumen[0].totalDescu.toFixed(2),
    subTotal: _dteResumen[0].subTotal.toFixed(2),
    valor: tributo.toFixed(2),
    subTotalVentas: _dteResumen[0].subTotalVentas.toFixed(2),
    ivaPerci1: _dteResumen[0].ivaPerci1.toFixed(2),
    ivaRete1: _dteResumen[0].ivaRete1.toFixed(2),
    reteRenta: _dteResumen[0].reteRenta.toFixed(2),
    montoTotalOperacion: _dteResumen[0].montoTotalOperacion.toFixed(2),
    totalPagar: _dteResumen[0].totalPagar.toFixed(2),
    totalLetras: _dteResumen[0].totalLetras,
    vendedor: ApVendedor,
    nombreV: ApNombreV,
    observaciones: ApObservaciones,
    formaPago: documentoData.formaPago || "-",
    diasCredito: documentoData.diasNeto || "-",
    fechaPago: documentoData.fechaPago || "-",
    descripcion: ApDescripcion,
    cliente: ApCliente,
    alias: ApAlias,
    pedido: ApPedido,
    apDirecion: ApDirecion,
    zona: ApMunicipio,
    needsSecondPage: prodlist.length >= 6,
  };

  const compiledHtml = hbs.compile(html)({ products: obj });
  const outputPath = path.join(
    __dirname,
    `../storage/pdf/${empresa[0].esquemaBD}/${dir}/${_ano}`,
    filePdf,
  );
  await generatePdfWithPuppeteer(compiledHtml, outputPath);
  console.log("PDF generado con Puppeteer:", outputPath);
};
const generaPdf07 = async (datos, _ano, _empresa_id) => {
  const filename = datos.replace("-26-", "-");
  const filePdf = datos.replace("-26-", "-") + ".pdf";
  const empresa = await Sqlempresa(empresa_id);
  const _dte = await sequelize.query(
    `select Dte_Id, tipoDoc,  CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,fechaemision ,codigoGeneracion,selloRecibido  from dte.dbo.dtes where  dte='${datos}'`,
    { type: QueryTypes.SELECT },
  );
  const _idDte = _dte[0].Dte_Id;
  // detalle de dte Cuerpo
  const _dteCuerpo = await sequelize.query(
    `SELECT numItem,tipoDte,tipoDoc,numeroDocumento, CONVERT(VARCHAR(10), fechaEmision, 23) as  fechaEmision,montoSujetoGrav, codigoRetencionMH,ivaRetenido,descripcion FROM dte.dbo.cuerpoDocumento  WHERE dte_Id=${_idDte} `,
    { type: QueryTypes.SELECT },
  );
  const _dteReceptor = await sequelize.query(
    `select * from dte.dbo.receptor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );

  const _dteResumen = await sequelize.query(
    `select totalSujetoRetencion,totalIVAretenido,totalLetras from dte.dbo.resumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );

  const datosQr = {
    fechaEmi: moment
      .tz(_dte[0].fechaemision, "America/El_Salvador")
      .format("YYYY-MM-DD"),
    codGen: _dte[0].codigoGeneracion,
    ambiente: process.env.DTE_AMBIENTE,
  };

  const htmlRaw07 = fs.readFileSync(
    path.join(__dirname, "../template/dte07/index.html"),
    "utf-8",
  );

  const qrUrl07 = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datosQr.ambiente || "01"}&codGen=${datosQr.codGen}&fechaEmi=${datosQr.fechaEmi}`;
  const qrSvg07 = await new Promise((resolve, reject) => {
    toString(qrUrl07, { type: "svg" }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const html = htmlRaw07.replace("[QR CODE]", qrSvg07);

  let array = [];
  let item = 0;

  _dteCuerpo.forEach((d) => {
    item = item + 1;
    const prod = {
      numItem: item,
      tipoDte: d.tipoDte,
      tipoDoc: d.tipoDoc,
      numeroDocumento: d.numeroDocumento,
      fechaEmision: d.fechaEmision,
      montoSujetoGrav: d.montoSujetoGrav.toFixed(2),
      codigoRetencionMH: d.codigoRetencionMH,
      ivaRetenido: d.ivaRetenido.toFixed(2),
      descripcion: d.descripcion,
    };
    array.push(prod);
  });
  let tipo,
    dir = "";
  if (_dte[0].tipoDoc === "03") {
    tipo = "COMPROBANTE CREDITO FISCAL";
    dir = "dte03";
  }
  if (_dte[0].tipoDoc === "01") {
    tipo = "COMPROBANTE CONSUMIDOR FINAL";
    dir = "dte01";
  }
  if (_dte[0].tipoDoc === "05") {
    tipo = "COMPROBANTE NOTA DE CREDITO";
    dir = "dte05";
  }
  if (_dte[0].tipoDoc === "07") {
    tipo = "COMPROBANTE DE RETENCIÓN";
    dir = "dte07";
  }

  const obj = {
    logoUrl: getLogoBase64(empresa),
    tipoDoc: tipo,
    codigoGeneracion: _dte[0].codigoGeneracion,
    numeroControl: filename,
    selloRecibido: _dte[0].selloRecibido,
    fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,
    fechaGeneracion: _dte[0].fecha,
    horaGeneracion: _dte[0].hora,
    nombre: _dteReceptor[0].nombre,
    nombreComercial: _dteReceptor[0].nombreComercial,
    nit: _dteReceptor[0].nit,
    nrc: _dteReceptor[0].nrc,
    descActividad: _dteReceptor[0].descActividad,
    direccion_compl: _dteReceptor[0].direccion_compl,
    telefono: _dteReceptor[0].telefono,
    correo: _dteReceptor[0].correo,
    prodlist: array,
    toltalSujetoRetencion: _dteResumen[0].totalSujetoRetencion,
    totalIvaretenido: _dteResumen[0].totalIVAretenido,
    totalIVAretenidoLetras: _dteResumen[0].totalLetras,
  };

  const document = {
    html: html,
    data: {
      products: obj,
    },
    path: `../backend/storage/pdf/${dir}/${_ano}/` + filePdf,
  };

  await pdf
    .create(document, options)
    .then((res) => {
      console.log("respuesta", res);
    })
    .catch((error) => {
      console.log(error);
    });
};
const generaPdf05 = async (datos, _ano, _empresa) => {
  const filename = datos.replace("-26-", "-");
  const filePdf = datos.replace("-26-", "-") + ".pdf";

  const empresa = await Sqlempresa(_empresa);
  const _dte = await sequelize.query(
    `select Dte_Id, tipoDoc,  CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,fechaemision ,codigoGeneracion,selloRecibido  from dte.dbo.dtes where  dte='${datos}' and Empresa_id='${_empresa}'`,
    { type: QueryTypes.SELECT },
  );
  const _idDte = _dte[0].Dte_Id;
  // detalle de dte Cuerpo
  const _dteCuerpo = await sequelize.query(
    `SELECT codigo,lote,descripcion,  sum(cantidad) as cantidad,sum(precioUni*cantidad) as precioUni,sum(montoDescu) as montoDescu,sum(ventaNoSuj) as ventaNoSuj,sum(ventaExenta) as ventaExenta,sum(ventaGravada) as ventaGravada  FROM dte.dbo.cuerpoDocumento  WHERE dte_Id=${_idDte} group by codigo,lote,descripcion`,
    { type: QueryTypes.SELECT },
  );
  const _dteDocRelacionados = await sequelize.query(
    `select tipoDocumento,numeroDocumento,CONVERT(VARCHAR(10), fechaEmision, 103) as fechaEmision from dte.dbo.documentoRelacionado where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteReceptor = await sequelize.query(
    `select * from dte.dbo.receptor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );

  const _dteResumen = await sequelize.query(
    `select * from dte.dbo.resumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteTributoResumen = await sequelize.query(
    `select * from dte.dbo.tributoresumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _apendice = await sequelize.query(
    `select * from dte.dbo.apendice where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  let ApVendedor = "";
  let ApNombre = "";
  let ApObservaciones = "";
  let ApDescripcion = "";
  let ApCliente = "";
  let ApPedido = "";
  let ApDirecion = "";
  for (let y = 0; y < _apendice.length; y++) {
    const element = _apendice[y];
    if (element.campo == "VENDEDOR") {
      ApVendedor = element.valor;
    }
    if (element.campo == "NOMBRE") {
      ApNombre = element.valor;
    }
    if (element.campo == "OBSERVACIONES") {
      ApObservaciones = element.valor;
    }
    if (element.campo == "DESCRIPCION") {
      ApDescripcion = element.valor;
    }
    if (element.campo == "CLIENTE") {
      ApCliente = element.valor;
    }
    if (element.campo == "PEDIDO") {
      ApPedido = element.valor;
    }
    if (element.campo == "DIRECION") {
      ApDirecion = element.valor;
    }
  }
  let tributo = "";
  if (_dteTributoResumen.length > 0) {
    tributo = _dteTributoResumen[0].valor;
  } else {
    tributo = 0.0;
  }

  const datosQr = {
    fechaEmi: moment
      .tz(_dte[0].fechaemision, "America/El_Salvador")
      .format("YYYY-MM-DD"),
    codGen: _dte[0].codigoGeneracion,
    ambiente: process.env.DTE_AMBIENTE,
  };

  const htmlRaw05 = fs.readFileSync(
    path.join(__dirname, "../template/dte05/index.html"),
    "utf-8",
  );

  const qrUrl05 = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datosQr.ambiente || "01"}&codGen=${datosQr.codGen}&fechaEmi=${datosQr.fechaEmi}`;
  const qrSvg05 = await new Promise((resolve, reject) => {
    toString(qrUrl05, { type: "svg" }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const html = htmlRaw05.replace("[QR CODE]", qrSvg05);

  let array = [];
  let item = 0;
  _dteCuerpo.forEach((d) => {
    item = item + 1;
    const prod = {
      numItem: item,
      codigo: d.codigo,
      cantidad: d.cantidad,
      uniMeduda: d.uniMedida,
      descripcion: d.descripcion,
      precioUni: (d.precioUni / d.cantidad).toFixed(4),
      montoDescu: d.montoDescu.toFixed(4),
      ventaNoSuj: d.ventaNoSuj.toFixed(4),
      ventaExenta: d.ventaExenta.toFixed(4),
      ventaGravada: d.ventaGravada.toFixed(2),
    };
    array.push(prod);
  });

  let array2 = [];
  _dteDocRelacionados.forEach((x) => {
    const prod = {
      tipoDoc: x.tipoDocumento,
      numeroDoc: x.numeroDocumento,
      fechaE: x.fechaEmision,
    };
    array2.push(prod);
  });
  let tipo,
    dir = "";
  if (_dte[0].tipoDoc === "03") {
    tipo = "COMPROBANTE CREDITO FISCAL";
    dir = "dte03";
  }
  if (_dte[0].tipoDoc === "01") {
    tipo = "COMPROBANTE CONSUMIDOR FINAL";
    dir = "dte01";
  }
  if (_dte[0].tipoDoc === "05") {
    tipo = "COMPROBANTE NOTA DE CREDITO";
    dir = "dte05";
  }
  const obj = {
    logoUrl: getLogoBase64(empresa),
    tipoDoc: tipo,
    codigoGeneracion: _dte[0].codigoGeneracion,
    numeroControl: filename,
    selloRecibido: _dte[0].selloRecibido,
    fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,
    fechaGeneracion: _dte[0].fecha,
    horaGeneracion: _dte[0].hora,
    nombre: _dteReceptor[0].nombre,
    nombreComercial: _dteReceptor[0].nombreComercial,
    nit: _dteReceptor[0].nit,
    nrc: _dteReceptor[0].nrc,
    descActividad: _dteReceptor[0].descActividad,
    direccion_compl: _dteReceptor[0].direccion_compl,
    telefono: _dteReceptor[0].telefono,
    correo: _dteReceptor[0].correo,
    prodlist: array,
    prodlistRela: array2,
    totalNoSuj: _dteResumen[0].totalNoSuj.toFixed(2),
    totalExenta: _dteResumen[0].totalExenta.toFixed(2),
    totalGravada: _dteResumen[0].totalGravada.toFixed(2),
    totalDescu: _dteResumen[0].totalDescu.toFixed(2),
    subTotal: _dteResumen[0].subTotal.toFixed(2),
    valor: tributo.toFixed(2),
    subTotalVentas: _dteResumen[0].subTotalVentas.toFixed(2),
    ivaPerci1: _dteResumen[0].ivaPerci1.toFixed(2),
    ivaRete1: _dteResumen[0].ivaRete1.toFixed(2),
    reteRenta: _dteResumen[0].reteRenta.toFixed(2),
    montoTotalOperacion: _dteResumen[0].montoTotalOperacion.toFixed(2),
    totalPagar: _dteResumen[0].totalPagar.toFixed(2),
    totalLetras: _dteResumen[0].totalLetras,
    vendedor: ApVendedor,
    nombreV: ApNombre,
    observaciones: ApObservaciones,
    descripcion: ApDescripcion,
    cliente: ApCliente,
    apDirecion: ApDirecion,
  };

  const document = {
    html: html,
    data: {
      products: obj,
    },
    path:
      `../backend/storage/pdf/${empresa[0].esquemaBD}/${dir}/${_ano}/` +
      filePdf,
  };

  await pdf
    .create(document, options)
    .then((res) => {
      console.log("respuesta", res);
    })
    .catch((error) => {
      console.log(error);
    });
};
const generaPdf14 = async (datos, _ano, _empresa) => {
  const filename = datos.replace("-26-", "-");
  const filePdf = datos.replace("-26-", "-") + ".pdf";

  const empresa = await Sqlempresa(_empresa);
  const _dte = await sequelize.query(
    `select Dte_Id, tipoDoc,  CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,fechaemision ,codigoGeneracion,selloRecibido ,Dte from dte.dbo.dtes where  dte='${datos}' and Empresa_id='${_empresa}'`,
    { type: QueryTypes.SELECT },
  );

  const _idDte = _dte[0].Dte_Id;

  const _dteSujetoExcluido = await sequelize.query(
    `SELECT tipoDocumento,nit, nombre,codActividad,descActividad,direccion_depa,direccion_muni,direccion_compl,telefono,correo  FROM dte.dbo.subjetoExcluido  WHERE dte_Id=${_idDte} `,
    { type: QueryTypes.SELECT },
  );

  // detalle de dte Cuerpo
  const _dteCuerpo = await sequelize.query(
    `SELECT numItem,tipoItem,cantidad,codigo,uniMedida,descripcion,precioUni,montoDescu,compra  FROM dte.dbo.cuerpoDocumento  WHERE dte_Id=${_idDte} `,
    { type: QueryTypes.SELECT },
  );

  const _dteResumen = await sequelize.query(
    `select totalCompra,descuExenta,totalDescu, subTotal,ivaRete1,reteRenta,totalPagar,totalLetras,condicionOperacion from dte.dbo.resumen where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteReceptor = await sequelize.query(
    `select * from dte.dbo.receptor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const _dteEmisior = await sequelize.query(
    `select * from dte.dbo.emisor where  dte_Id=${_idDte}`,
    { type: QueryTypes.SELECT },
  );
  const datosQr = {
    fechaEmi: moment
      .tz(_dte[0].fechaHoraGeneracion, "America/El_Salvador")
      .format("YYYY-MM-DD"),
    codGen: _dte[0].codigoGeneracion,
    ambiente: process.env.DTE_AMBIENTE,
  };

  const htmlRaw14 = fs.readFileSync(
    path.join(__dirname, "../template/dte14/index.html"),
    "utf-8",
  );

  const qrUrl14 = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datosQr.ambiente || "01"}&codGen=${datosQr.codGen}&fechaEmi=${datosQr.fechaEmi}`;
  const qrSvg14 = await new Promise((resolve, reject) => {
    toString(qrUrl14, { type: "svg" }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const html = htmlRaw14.replace("[QR CODE]", qrSvg14);

  let array = [];
  let item = 0;

  _dteCuerpo.forEach((d) => {
    item = item + 1;
    const prod = {
      numItem: item,
      tipoItem: d.tipoItem,
      cantidad: d.cantidad,
      codigo: null,
      uniMedida: "UNIDAD",
      descripcion: d.descripcion,
      precioUni: d.precioUni.toFixed(2),
      montoDescu: d.montoDescu.toFixed(2),
      compra: d.compra.toFixed(2),
    };
    array.push(prod);
  });

  let tipo,
    dir = "";
  if (_dte[0].tipoDoc === "03") {
    tipo = "COMPROBANTE CREDITO FISCAL";
    dir = "dte03";
  }
  if (_dte[0].tipoDoc === "01") {
    tipo = "COMPROBANTE CONSUMIDOR FINAL";
    dir = "dte01";
  }
  if (_dte[0].tipoDoc === "05") {
    tipo = "COMPROBANTE NOTA DE CREDITO";
    dir = "dte05";
  }
  if (_dte[0].tipoDoc === "07") {
    tipo = "COMPROBANTE DE RETENCIÓN";
    dir = "dte07";
  }
  if (_dte[0].tipoDoc === "14") {
    tipo = "FACTURA SUJETO EXCLUIDO";
    dir = "dte14";
  }

  const obj = {
    logoUrl: getLogoBase64(empresa),
    tipoDoc: tipo,
    codigoGeneracion: _dte[0].codigoGeneracion,
    numeroControl: _dte[0].Dte,
    selloRecibido: _dte[0].selloRecibido,
    fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,
    fechaGeneracion: _dte[0].fecha,
    horaGeneracion: _dte[0].hora,
    nombreEmisor: _dteEmisior[0].nombre,
    nitEmisor: _dteEmisior[0].nit,
    nrcEmisor: _dteEmisior[0].nrc,
    actividadEmisor: _dteEmisior[0].descActividad,
    direccionEmisor: _dteEmisior[0].direccion_compl,
    telefonoEmisor: _dteEmisior[0].telefono,
    correoEmisor: _dteEmisior[0].correo,
    nombreComercialEmisor: _dteEmisior[0].nombreComercial,
    nombre: _dteSujetoExcluido[0].nombre,
    nit: _dteSujetoExcluido[0].nit,
    descActividad: _dteSujetoExcluido[0].descActividad,
    direccion_compl: _dteSujetoExcluido[0].direccion_compl,
    telefono: _dteSujetoExcluido[0].telefono,
    correo: _dteSujetoExcluido[0].correo,
    prodlist: array,
    totalCompras: _dteResumen[0].totalCompra.toFixed(2),
    descu: 0.0,
    subTotal: _dteResumen[0].subTotal.toFixed(2),
    ivaRete1: _dteResumen[0].ivaRete1.toFixed(2),
    reteRenta: _dteResumen[0].reteRenta.toFixed(2),
    totalPagar: _dteResumen[0].totalPagar.toFixed(2),
    totalLetras: _dteResumen[0].totalLetras,
  };
  //console.log(obj);

  const document = {
    html: html,
    data: {
      products: obj,
    },
    path:
      `../backend/storage/pdf/${empresa[0].esquemaBD}/${dir}/${_ano}/` +
      filePdf,
  };

  await pdf
    .create(document, options)
    .then((res) => {
      console.log("respuesta", res);
    })
    .catch((error) => {
      console.log(error);
    });
};
module.exports = { generaPdf, generaPdf07, generaPdf05, generaPdf14 };
