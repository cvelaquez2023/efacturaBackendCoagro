const puppeteer = require("puppeteer");
const hbs = require("handlebars");
const fs = require("fs-extra");
const path = require("path");
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");
const moment = require("moment");

const compile = async (templateName, data) => {
  const filePath = path.join(
    process.cwd(),
    `template/dte`,
    `${templateName}.html`
  );
  const html = await fs.readFile(filePath, "utf-8");
  return hbs.compile(html)(data);
};

const pdfNuew = async function (datos) {
  try {
    const data = await obj(datos);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const content = await compile("index", data);
    await page.setContent(content);

    await page.pdf({
      path: "output.pdf",
      format: "Letter",
      printBackground: true,
    });
    console.log("done creating pdf");
    await browser.close();
    //process.exit();
  } catch (error) {
    console.log(error);
  }
};

const obj = async (datos) => {
  try {
    //extraemos los datos de documento
    const filename = datos.replace("-24-", "-");
    const filePdf = datos.replace("-24-", "-") + ".pdf";

    const _dte = await sequelize.query(
      `select Dte_Id, tipoDoc,  CONVERT(varchar,fechaemision,103) as fecha, CONVERT(varchar,fechaemision,108) as hora,fechaemision ,codigoGeneracion,selloRecibido  from dte.dbo.dtes where  dte='${datos}'`,
      { type: QueryTypes.SELECT }
    );
    const _idDte = _dte[0].Dte_Id;
    // detalle de dte Cuerpo
    const _dteCuerpo = await sequelize.query(
      `SELECT codigo,lote,descripcion,  sum(cantidad) as cantidad,sum(precioUni*cantidad) as precioUni,sum(montoDescu) as montoDescu,sum(ventaNoSuj) as ventaNoSuj,sum(ventaExenta) as ventaExenta,sum(ventaGravada) as ventaGravada  FROM dte.dbo.cuerpoDocumento  WHERE dte_Id=${_idDte} group by codigo,lote,descripcion`,
      { type: QueryTypes.SELECT }
    );
    const _dteReceptor = await sequelize.query(
      `select * from dte.dbo.receptor where  dte_Id=${_idDte}`,
      { type: QueryTypes.SELECT }
    );

    const _dteResumen = await sequelize.query(
      `select * from dte.dbo.resumen where  dte_Id=${_idDte}`,
      { type: QueryTypes.SELECT }
    );
    const _dteTributoResumen = await sequelize.query(
      `select * from dte.dbo.tributoresumen where  dte_Id=${_idDte}`,
      { type: QueryTypes.SELECT }
    );
    const _apendice = await sequelize.query(
      `select * from dte.dbo.apendice where  dte_Id=${_idDte}`,
      { type: QueryTypes.SELECT }
    );
    let ApVendedor = "";
    let ApNombreV = "";
    let ApObservaciones = "";
    let ApDescripcion = "";
    let ApCliente = "";
    let ApAlias = "";
    let ApPedido = "";
    let ApDirecion = "";
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

    /*
 await rqcode(datosQr);
 const html = fs.readFileSync(
   path.join(__dirname, "../template/index.html"),
   "utf-8"
 );
 */
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
      tipoDoc: tipo,
      codigoGeneracion: _dte[0].codigoGeneracion,
      numeroControl: filename,
      selloRecibido: _dte[0].selloRecibido,
      fechaHoraGeneracion: _dte[0].fecha + " " + _dte[0].hora,
      nombre: _dteReceptor[0].nombre,
      nombreComercial: _dteReceptor[0].nombreComercial,
      nit: _dteReceptor[0].nit,
      nrc: _dteReceptor[0].nrc,
      descActividad: _dteReceptor[0].descActividad,
      direccion_compl: _dteReceptor[0].direccion_compl,
      telefono: _dteReceptor[0].telefono,
      correo: _dteReceptor[0].correo,
      prodlist: array,
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
      descripcion: ApDescripcion,
      cliente: ApCliente,
      alias: ApAlias,
      pedido: ApPedido,
      apDirecion: ApDirecion,
    };
    return obj;
  } catch (error) {
    console.log(error);
  }
};
module.exports = { pdfNuew };
