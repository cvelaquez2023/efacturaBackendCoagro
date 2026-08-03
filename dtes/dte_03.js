//03 Comprobante de Credito fiscal
const _ambiente = process.env.DTE_AMBIENTE;
const _version = process.env.DTE_VERSION;
const _moneda = process.env.MONEDA;
const uuid = require("uuid");
const { facturaModel, clienteModel } = require("../models");
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");
const { NumeroLetras } = require("../config/letrasNumeros");
const _codigoGeneracion = uuid.v4().toUpperCase();

const dte_03 = async (documento) => {
  try {
    const data = await facturaModel.findAll({
      where: { FACTURA: documento },
      raw: true,
    });
    const dataCliente = await clienteModel.findAll({
      where: { CLIENTE: data[0].CLIENTE },
    });
    const _fechaNueva = new Date(data[0].FECHA_HORA).toLocaleDateString(
      "sv-SE"
    );
    const _hora = new Date(data[0].FECHA_HORA).toLocaleTimeString();
    //CONSTRUIMOS EL SEGMENTO IDENTIFICACION
    const identificacion = {
      version: parseInt(_version),
      ambiente: _ambiente,
      tipoDte: "03",
      //numeroControl: factura,
      numeroControl: "DTE-03-00000000-000000000000001",
      codigoGeneracion: _codigoGeneracion,
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: _fechaNueva,
      horEmi: _hora,
      tipoMoneda: _moneda,
    };
    const documentoRelacionado = null;
    const emisor = {
      nit: process.env.DTE_NIT,
      nrc: process.env.DTE_NRC.replace("-", ""),
      nombre: process.env.DTE_NOMBRE,
      codActividad: process.env.DTE_CODACTIVIDAD,
      descActividad: process.env.DTE_DESCACTIVIDAD,
      nombreComercial: process.env.DTE_NOMBRECOMERCIAL,
      tipoEstablecimiento: "01",
      direccion: {
        departamento: process.env.DTE_DEPARTAMENTO,
        municipio: process.env.DTE_MUNICIPIO,
        complemento: process.env.DTE_COMPLEMENTO,
      },
      telefono: process.env.DTE_TELEFONO,
      correo: process.env.DTE_CORREO,
      codEstableMH: process.env.DTE_CODESTABLEMH,
      codEstable: process.env.DTE_CODESTABLE,
      codPuntoVentaMH: process.env.DTE_CODPUNTOVENTAMH,
      codPuntoVenta: process.env.DTE_CODPUNTOVENTA,
    };
    const receptor = {
      nit: dataCliente[0].CONTRIBUYENTE,
      nrc: dataCliente[0].RUBRO1_CLI.replace("-", ""),
      nombre: dataCliente[0].ALIAS,
      codActividad: dataCliente[0].RUBRO8_CLIENTE,
      descActividad: dataCliente[0].RUBRO9_CLIENTE,
      nombreComercial: dataCliente[0].NOMBRE,
      direccion: {
        departamento: dataCliente[0].Zona.substring(0, 2),
        municipio: dataCliente[0].Zona.substring(2, 4),
        complemento: dataCliente[0].DIRECCION,
      },
      telefono: dataCliente[0].TELEFONO1,
      correo: dataCliente[0].RUBRO7_CLIENTE,
    };
    //DESGLOSAMOS OTROS DOCUMENTOS
    const otrosDocumentos = null;

    //DESGLOSAMOS VENTAS A TERCEROS
    const ventaTercero = null;

    //DESGLOSAMOS EL CUERPO DEL DOCUMENTO
    //extraemos productos de la factura
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLinea '${documento}'`,
      { type: QueryTypes.SELECT }
    );
    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = 0;
    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const data = {
        numItem: element.LINEA,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion:
          element.DESCRIPCION +
          " LOTE:" +
          element.LOTE +
          " FECHA_VENCE:" +
          element.FECHAVENCE,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: element.PRECIO_UNITARIO,
        montoDescu: element.DESC_TOT_LINEA + element.DESCUENTO_VOLUMEN,
        ventaNoSuj: 0.0,
        ventaExenta: 0.0,
        ventaGravada: element.PRECIO_TOTAL,
        tributos: ["20"],
        psv: 0.0,
        noGravado: 0,
      };
      const _totalLinea = element.CANTIDAD * element.PRECIO_UNITARIO;
      const _totalDescuento =
        element.DESC_TOT_LINEA + element.DESCUENTO_VOLUMEN;
      const _totalImpuesto1 = element.TOTAL_IMPUESTO1;
      totalLinea = totalLinea + _totalLinea;
      totalDescuento = totalDescuento + _totalDescuento;
      totalImpuesto1 = totalImpuesto1 + _totalImpuesto1;
      _cuerpoDoc.push(data);
    }

    const _totalPagar = parseFloat(
      (totalLinea - totalDescuento + totalImpuesto1).toFixed(2)
    );
    //Resumen
    const _resumen = {
      totalNoSuj: 0.0,
      totalExenta: 0.0,
      totalGravada: parseFloat(totalLinea.toFixed(2)),
      descuNoSuj: 0.0,
      descuExenta: 0.0,
      descuGravada: parseFloat(totalDescuento.toFixed(2)),
      porcentajeDescuento: 0.0,
      totalDescu: parseFloat(totalDescuento.toFixed(2)),
      tributos: [
        {
          codigo: "20",
          descripcion: "Impuesto al Valor Agregado 13%",
          valor: parseFloat(totalImpuesto1.toFixed(2)),
        },
      ],
      subTotal: parseFloat((totalLinea - totalDescuento).toFixed(2)),
      ivaPerci1: 0,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion: parseFloat(
        (totalLinea - totalDescuento + totalImpuesto1).toFixed(2)
      ),
      totalNoGravado: 0,
      totalPagar: _totalPagar,
      totalLetras: NumeroLetras(_totalPagar) + " USD",
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: [
        {
          codigo: "01",
          montoPago: _totalPagar,
          plazo: null,
          referencia: null,
          periodo: null,
        },
      ],
      numPagoElectronico: null,
    };
    const _extension = null;
    const _apendice = null;

    const datos = {
      identificacion,
      documentoRelacionado,
      emisor,
      receptor,
      otrosDocumentos,
      ventaTercero,
      cuerpoDocumento: _cuerpoDoc,
      resumen: _resumen,
      extension: _extension,
      apendice: _apendice,
    };

    return datos;
  } catch (error) {
    console.log("errrr", error);
  }
};

module.exports = dte_03;
