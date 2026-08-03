const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const http = require("http");
const https = require("https");
const {
  consecutivoFaModel,
  clienteModel,
  pedidoModel,
  pedidoLineaModel,
  nitModel,
  facturaModel,
  subtipoDocCCModel,
} = require("../models");
const { NumeroLetras } = require("../config/letrasNumeros");

const moment = require("moment");
const { error } = require("console");
const { type } = require("os");
const { query } = require("express");
const dte_01 = require("../dtes/dte_01");
const { json } = require("body-parser");
const dte_03 = require("../dtes/dte_03");

const getPedido = async (req, res) => {
  try {
    const user = req.cliente;
    //Consultamos datos del cliente
    const datosCliente = await clienteModel.findOne({
      attributes: [
        "CLIENTE",
        "NOMBRE",
        "CONTRIBUYENTE",
        "RUBRO1_CLI",
        "RUBRO2_CLI",
        "Telefono1",
        "E_Mail",
      ],
      where: { CLIENTE: user.CLIENTE },
    });
    //const ClienteContribuyente = datosCliente.CONTRIBUYENTE;
    //const ClienteNRC = datosCliente.RUBRO1_CLI;
    //const ClienteGiro = datosCliente.RUBRO2_CLI;

    //Validamos que tipo de documento quiere el cliente
    //Si es 1 =Credito Fiscal y si es 2= es Consumidor Final
    //Si es Credito Fiscal necesito validar si existe los documentos necesarios
    //que son el NIT,NRC y GIRO
    //Procedmos a validacion
    if (req.body.tipoDoc == 1) {
      //Solicita Credito Fiscal
      //Validamos si los que envia esta en la base de datos registrada al cliente
      const existNit = await nitModel.findOne({
        where: { NIT: req.body.Nit },
      });

      if (existNit == null) {
        //si no existe el numero de nit procedemos a crearlo en la tabla NIT
        const NIT = {
          NIT: req.body.Nit,
          RAZON_SOCIAL: datosCliente.NOMBRE,
          ALIAS: datosCliente.NOMBRE,
          TIPO: "ND",
          ORIGEN: "O",
          NUMERO_DOC_NIT: req.body.Nit,
          EXTERIOR: 0,
          NATURALEZA: "N",
          ACTIVO: "S",
          TIPO_CONTRIBUYENTE: "F",
          NRC: req.body.Nrc,
          GIRO: req.body.Giro,
          CATEGORIA: req.body.Categoria,
          TIPO_REGIMEN: "S",
          INF_LEGAL: "N",
          DETALLAR_KITS: "N",
          ACEPTA_DOC_ELECTRONICO: "N",
          USA_REPORTE_D151: "N",
        };
        const CreateNit = await nitModel.create(NIT);
        if (CreateNit != null) {
          //actualizamos los datos del cliente
          const actualizaCliente = await clienteModel.update(
            {
              CONTRIBUYENTE: req.body.Nit,
              RUBRO1_CLI: req.body.Nrc,
              RUBRO2_CLI: req.body.Giro,
              RUBRO3_CLI: req.body.Categoria,
            },
            { where: { CLIENTE: req.body.cliente } }
          );
        }
      }
    }

    //Consultamos el numero de pedido que nos toca asignar.
    const ConsPedido = await consecutivoFaModel.findOne({
      where: { CODIGO_CONSECUTIVO: req.query.Conse },
    });

    const ultimoValor = ConsPedido.VALOR_CONSECUTIVO;
    const valor = ultimoValor.split("-");
    const valor0 = valor[0];
    const valor1 = valor[1];
    const cara = valor1.length;
    const consecutivo = Math.floor(valor1);
    const fill = (number, len) =>
      "0".repeat(len - number.toString().length) + number.toString();

    //Nuevo correlativo
    const nuevoCorrelativo = valor0 + "-" + fill(consecutivo + 1, cara);

    //traemos informacion de Cliente y monto
    //Consultamos al cliente
    const Cliente = await clienteModel.findOne({
      where: { CLIENTE: req.body.cliente },
    });

    //    console.log(Cliente);
    //Montamos datos para el encabezado de pedido

    var fecha_utc = formatDate(new Date());
    const encabezado = {
      PEDIDO: nuevoCorrelativo,
      ESTADO: "N",
      FECHA_PEDIDO: fecha_utc,
      FECHA_PROMETIDA: fecha_utc,
      FECHA_PROX_EMBARQU: fecha_utc,
      FECHA_ULT_EMBARQUE: "01-01-1980",
      FECHA_ULT_CANCELAC: "01-01-1980",
      FECHA_ORDEN: fecha_utc,
      EMBARCAR_A: Cliente.NOMBRE,
      DIREC_EMBARQUE: "ND",
      DIRECCION_FACTURA: req.body.direccion,
      OBSERVACIONES: req.body.observaciones,
      TOTAL_MERCADERIA: parseFloat((req.body.total / 1.13).toFixed(2)),
      MONTO_ANTICIPO: 0,
      MONTO_FLETE: 0,
      MONTO_SEGURO: 0,
      MONTO_DOCUMENTACIO: 0,
      TIPO_DESCUENTO1: "P",
      TIPO_DESCUENTO2: "P",
      MONTO_DESCUENTO1: 0,
      MONTO_DESCUENTO2: 0,
      PORC_DESCUENTO1: 0,
      PORC_DESCUENTO2: 0,
      TOTAL_IMPUESTO1: parseFloat(
        (req.body.total - req.body.total / 1.13).toFixed(2)
      ),
      TOTAL_IMPUESTO2: 0,
      TOTAL_A_FACTURAR: parseFloat(req.body.total.toFixed(2)),
      PORC_COMI_VENDEDOR: 0,
      PORC_COMI_COBRADOR: 0,
      TOTAL_CANCELADO: 0,
      TOTAL_UNIDADES: req.body.totalUnidades,
      IMPRESO: "N",
      FECHA_HORA: fecha_utc,
      DESCUENTO_VOLUMEN: 0,
      TIPO_PEDIDO: "N",
      MONEDA_PEDIDO: "L",
      VERSION_NP: 1,
      AUTORIZADO: "N",
      DOC_A_GENERAR: "F",
      CLASE_PEDIDO: "N",
      MONEDA: "L",
      NIVEL_PRECIO: Cliente.Nivel_Precio,
      COBRADOR: Cliente.Cobrador,
      RUTA: Cliente.Ruta,
      USUARIO: "SA",
      CONDICION_PAGO: Cliente.Condicion_Pago,
      BODEGA: req.body.bodega,
      ZONA: Cliente.Zona,
      VENDEDOR: Cliente.Vendedor,
      CLIENTE: req.body.cliente,
      CLIENTE_DIRECCION: req.body.cliente,
      CLIENTE_CORPORAC: req.body.cliente,
      CLIENTE_ORIGEN: req.body.cliente,
      PAIS: Cliente.Pais,
      SUBTIPO_DOC_CXC: req.body.tipoDoc,
      TIPO_DOC_CXC: "FAC",
      BACKORDER: "N",
      PORC_INTCTE: 0.0,
      DESCUENTO_CASCADA: "N",
      FIJAR_TIPO_CAMBIO: "N",
      ORIGEN_PEDIDO: "F",
      BASE_IMPUESTO1: req.body.total,
      BASE_IMPUESTO2: 0.0,
      NOMBRE_CLIENTE: Cliente.NOMBRE,
      FECHA_PROYECTADA: fecha_utc,
      TIPO_DOCUMENTO: "P",
      TASA_IMPOSITIVA_PORC: 0.0,
      TASA_CREE1_PORC: 0.0,
      TASA_CREE2_PORC: 0.0,
      TASA_GAN_OCASIONAL_PORC: 0.0,
      CONTRATO_REVENTA: "N",
    };

    const detalle = req.body.detalle;

    //  console.log(encabezado);
    //Insertamos pedido en Softaland
    const nuevoPedido = await pedidoModel.create(encabezado);
    //actualizmos correlativo

    const results = await consecutivoFaModel.update(
      {
        VALOR_CONSECUTIVO: nuevoCorrelativo,
      },
      { where: { CODIGO_CONSECUTIVO: req.query.Conse } }
    );

    if (results > 0) {
      //GUARDAMOS LINEAS DE PEDIDO.
      var Consec = 0;
      for (var value of detalle) {
        Consec = Consec + 1;
        const pedidoLinea = {
          PEDIDO: nuevoCorrelativo,
          PEDIDO_LINEA: Consec,
          BODEGA: req.body.bodega,
          ARTICULO: value.producto,
          ESTADO: "N",
          FECHA_ENTREGA: fecha_utc,
          LINEA_USUARIO: Consec,
          PRECIO_UNITARIO: parseFloat((value.precio / 1.13).toFixed(2)),
          CANTIDAD_PEDIDA: value.cantidad,
          CANTIDAD_A_FACTURA: value.cantidad,
          CANTIDAD_FACTURADA: 0,
          CANTIDAD_RESERVADA: 0,
          CANTIDAD_BONIFICAD: 0,
          CANTIDAD_CANCELADA: 0,
          TIPO_DESCUENTO: "P",
          MONTO_DESCUENTO: 0,
          PORC_DESCUENTO: 0,
          FECHA_PROMETIDA: fecha_utc,
          CENTRO_COSTO: "1-1-01-001",
          CUENTA_CONTABLE: "4-1-01-01-01-01-00",
          TIPO_DESC: 0,
          PORC_EXONERACION: 0,
          PORC_IMPUESTO1: 13,
          PORC_IMPUESTO2: 0,
          ES_OTRO_CARGO: "N",
          ES_CANASTA_BASICA: "N",
        };

        const pedidoLineaNew = await pedidoLineaModel.create(pedidoLinea);
      }
    }

    const data3 = await sequelize.query(
      `EXEC bellmart.sP_Factura_API '${nuevoCorrelativo}','${req.body.ConsecutivoFA}',${req.body.tipoDoc},'${req.body.CondicionPago}'`,
      { type: QueryTypes.SELECT }
    );

    const factura = await sequelize.query(
      "SELECT FACTURA FROM bellmart.FACTURA  WHERE PEDIDO=(:pedido) ",
      {
        replacements: { pedido: nuevoCorrelativo },
      },
      { type: QueryTypes.SELECT }
    );

    dataNew = JSON.stringify(factura[0]);
    dataNew = JSON.parse(dataNew);

    //console.log(dataNew)
    //Procedemos a realizar la factura por medio de un procedimiento almacenado
    res.send({ results: dataNew, result: "true" });
  } catch (error) {
    console.log(error);
  }
};
const getFactura = async (req, res) => {
  const factura = req.params.fac;
  const _ambiente = process.env.DTE_AMBIENTE;
  const _moneda = process.env.MONEDA;

  const _nit = process.env.DTE_NIT;

  if (!factura) {
    return res.status(400).send({ messaje: "Es requerida Numero Factura" });
  }

  //consultamos factura

  /*
  const data = await facturaModel.findAll({
    where: { FACTURA: factura },
    raw: true,
  });
  */

  const data = await sequelize.query(`EXEC dte.dbo.dte_Factura '${factura}'`, {
    type: QueryTypes.SELECT,
  });


  //CONSULTAMOS EL SUBTIPO DEL DOCUMENTO
  const subtipo = await subtipoDocCCModel.findAll({
    where: { TIPO: data[0].TIPO_CREDITO_CXC, SUBTIPO: data[0].SUBTIPO_DOC_CXC },
    raw: true,
  });
  const _tipoDte = subtipo[0].ct002;

  //llamamos el dte por medio de subtipo

  //consultamos el cliente con los datos

  const dataCliente = await sequelize.query(
    `EXEC dte.dbo.dte_Cliente '${data[0].CLIENTE}'`,
    {
      type: QueryTypes.SELECT,
    }
  );

  const uuid = require("uuid");
  const _codigoGeneracion = uuid.v4().toUpperCase();
  const _fechaNueva = data[0].FECHA;
  const _hora = data[0].HORA;

  let _version = 0;
  if (_tipoDte == "01") {
    _version = 1;
  }
  if (_tipoDte == "03") {
    _version = 3;
  }

  //CONSTRUIMOS EL SEGMENTO IDENTIFICACION
  const identificacion = {
    version: _version,
    ambiente: _ambiente,
    tipoDte: _tipoDte,
    //numeroControl: factura,
    numeroControl: "DTE-03-00000000-000000000000009",
    //numeroControl: "DTE-01-00000000-000000000000001",
    codigoGeneracion: _codigoGeneracion.toUpperCase(),
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
    telefono: process.env.DTE_TELEFONO.replace("-", ""),
    correo: process.env.DTE_CORREO,
    codEstableMH: process.env.DTE_CODESTABLEMH,
    codEstable: process.env.DTE_CODESTABLE,
    codPuntoVentaMH: process.env.DTE_CODPUNTOVENTAMH,
    codPuntoVenta: process.env.DTE_CODPUNTOVENTA,
  };

  const creacionJson = async () => {
    if (_tipoDte === "01") {
      //factura
      datos = {
        receptor: {
          tipoDocumento: "36",
          numDocumento: dataCliente[0].CONTRIBUYENTE,
          nrc: null,
          nombre: dataCliente[0].ALIAS,
          codActividad: null,
          descActividad: null,
          //nombreComercial: dataCliente[0].NOMBRE,
          direccion: {
            departamento: dataCliente[0].ZONA.substring(0, 2),
            municipio: dataCliente[0].ZONA.substring(2, 4),
            complemento: dataCliente[0].DIRECCION,
          },
          telefono: dataCliente[0].TELEFONO1.replace("-", ""),
          correo: dataCliente[0].RUBRO7_CLIENTE,
        },
        //DESGLOSAMOS OTROS DOCUMENTOS
        otrosDocumentos: null,
        ventaTercero: null,
      };
      return datos;
    }
    if (_tipoDte == "03") {
      //Credito Fiscal
      datos = {
        receptor: {
          nit: dataCliente[0].CONTRIBUYENTE,
          nrc: dataCliente[0].RUBRO1_CLI.replace("-", ""),
          nombre: dataCliente[0].ALIAS,
          codActividad: dataCliente[0].RUBRO8_CLIENTE,
          descActividad: dataCliente[0].RUBRO9_CLIENTE,
          nombreComercial: dataCliente[0].NOMBRE,
          direccion: {
            departamento: dataCliente[0].ZONA.substring(0, 2),
            municipio: dataCliente[0].ZONA.substring(2, 4),
            complemento: dataCliente[0].DIRECCION,
          },
          telefono: dataCliente[0].TELEFONO1.replace("-", ""),
          correo: dataCliente[0].RUBRO7_CLIENTE,
        },
        //DESGLOSAMOS OTROS DOCUMENTOS
        otrosDocumentos: null,
        ventaTercero: null,
      };
      return datos;
    }
    if (_tipoDte == "11") {
      //Factura exportacion
      datos = {
        receptor: {
          nit: dataCliente[0].CONTRIBUYENTE,
          nrc: dataCliente[0].RUBRO1_CLI.replace("-", ""),
          nombre: dataCliente[0].ALIAS,
          codActividad: dataCliente[0].RUBRO8_CLIENTE,
          descActividad: dataCliente[0].RUBRO9_CLIENTE,
          nombreComercial: dataCliente[0].NOMBRE,
          direccion: {
            departamento: dataCliente[0].ZONA.substring(0, 2),
            municipio: dataCliente[0].ZONA.substring(2, 4),
            complemento: dataCliente[0].DIRECCION,
          },
          telefono: dataCliente[0].TELEFONO1.replace("-", ""),
          correo: dataCliente[0].RUBRO7_CLIENTE,
        },
        //DESGLOSAMOS OTROS DOCUMENTOS
        otrosDocumentos: null,
        ventaTercero: null,
      };
      return datos;
    }
  };
  const _json = await creacionJson();

  //  console.log("dte_03", _json.receptor);

  //DESGLOSAMOS EL CUERPO DEL DOCUMENTO
  //extraemos productos de la factura
  const dataFacLinea = await sequelize.query(
    `EXEC dte.dbo.dte_FacturaLinea '${factura}'`,
    { type: QueryTypes.SELECT }
  );
  const _cuerpoDoc = [];
  let totalLinea = 0;
  let totalDescuento = 0;
  let totalImpuesto1 = 0;
  let ventatotalGravada = 0;
  for (let index = 0; index < dataFacLinea.length; index++) {
    const element = dataFacLinea[index];
    const precio = element.PRECIO_UNITARIO;
    const decLinea = element.DESC_TOT_LINEA;
    const decVolumen = element.DESCUENTO_VOLUMEN;
    const totalDesc = decLinea + decVolumen;
    const cantidad = element.CANTIDAD;
    const precioTotal = precio * cantidad;
    const ventagravada = precioTotal - totalDesc;

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
      precioUni: precio,
      montoDescu: totalDesc,
      ventaNoSuj: 0.0,
      ventaExenta: 0.0,
      ventaGravada: parseFloat(ventagravada.toFixed(4)),
      tributos: ["20"],
      psv: 0.0,
      noGravado: 0,
    };
    const _totalLinea = precioTotal;
    const _totalDescuento = totalDesc;
    const _totalImpuesto1 = element.TOTAL_IMPUESTO1;
    const _totalVentaGRavada = precioTotal - totalDesc;
    totalLinea = totalLinea + _totalLinea;
    totalDescuento = totalDescuento + _totalDescuento;
    totalImpuesto1 = totalImpuesto1 + _totalImpuesto1;

    ventatotalGravada = ventatotalGravada + _totalVentaGRavada;
    _cuerpoDoc.push(data);
  }

  const _totalPagar = totalLinea - totalDescuento + totalImpuesto1;

  //Resumen
  const _resumen = {
    totalNoSuj: 0.0,
    totalExenta: 0.0,
    totalGravada: parseFloat(ventatotalGravada.toFixed(2)),
    subTotalVentas: parseFloat(ventatotalGravada.toFixed(2)),
    descuNoSuj: 0.0,
    descuExenta: 0.0,
    descuGravada: 0.0,
    porcentajeDescuento: 0.0,
    totalDescu: parseFloat(totalDescuento.toFixed(2)),
    tributos: [
      {
        codigo: "20",
        descripcion: "Impuesto al Valor Agregado 13%",
        valor: parseFloat(totalImpuesto1.toFixed(2)),
      },
    ],
    subTotal: parseFloat(ventatotalGravada.toFixed(2)),
    ivaPerci1: 0,
    ivaRete1: 0,
    reteRenta: 0,
    montoTotalOperacion: parseFloat(
      (totalLinea - totalDescuento + totalImpuesto1).toFixed(2)
    ),
    totalNoGravado: 0,
    totalPagar: parseFloat(_totalPagar.toFixed(2)),
    totalLetras: NumeroLetras(parseFloat(_totalPagar.toFixed(2))) + " USD",
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: parseFloat(_totalPagar.toFixed(2)),
        plazo: null,
        referencia: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };

  //insertamos en las diferentes tablas de dte
  //Dtes
  await sequelize.query(
    `insert into dte.dbo.dtes(dte,createDate,origen,nombre,procesado,mudulo,tipoDoc,selloRecibido,codigoGeneracion,estado,fechaemision,montoTotal,documento) values('${factura}',getdate(),'CLIENTE','${dataCliente[0].NOMBRE}',0,'FA', '${_tipoDte}','ND','${_codigoGeneracion}','PENDIENTE','${_fechaNueva}',${_totalPagar},'${dataCliente[0].CONTRIBUYENTE}')`,
    { type: QueryTypes.SELECT }
  );
  const dte_id = await sequelize.query(
    `select Dte_id from dte.dbo.dtes where dte='${factura}'`,
    { type: QueryTypes.SELECT }
  );

  const _dteId = dte_id[0].Dte_id;

  //insertamos en identificacion
  await sequelize.query(
    `insert into dte.dbo.identificacion(Dte_id,version,ambiente,tipoDte,numeroControl,codigoGeneracion,tipoModelo,tipoOPeracion,fecEmi,horEmi,tipoMoneda) values(${_dteId},${identificacion.version},'${identificacion.ambiente}', '${identificacion.tipoDte}', '${identificacion.numeroControl}','${identificacion.codigoGeneracion}',${identificacion.tipoModelo},${identificacion.tipoOperacion},'${identificacion.fecEmi}','${identificacion.horEmi}','${identificacion.tipoMoneda}')`,
    { type: QueryTypes.SELECT }
  );
  //insertamos emisor
  await sequelize.query(
    `insert into dte.dbo.emisor(dte_id,nit,nrc,nombre,codActividad,descActividad,nombreComercial,tipoEstablecimiento,direccion_depa,direccion_muni,direccion_compl,telefono,correo,codEstableMH,codEstable,codPuntoVentaMH,codPuntoVenta) values(${_dteId},'${emisor.nit}','${emisor.nrc}','${emisor.nombre}','${emisor.codActividad}','${emisor.descActividad}','${emisor.nombreComercial}','${emisor.tipoEstablecimiento}','${emisor.direccion.departamento}','${emisor.direccion.municipio}','${emisor.direccion.complemento}','${emisor.telefono}','${emisor.correo}','${emisor.codEstableMH}','${emisor.codEstable}','${emisor.codPuntoVentaMH}','${emisor.codPuntoVenta}')`,
    { type: QueryTypes.SELECT }
  );

  //insertamos receptor
  if (_tipoDte === "01") {
    await sequelize.query(
      `insert into dte.dbo.receptor(dte_id,nit,nrc,nombre,codActividad,descActividad,nombreComercial,direccion_depa,direccion_muni,direccion_compl,telefono,correo) values (${_dteId},'${_json.receptor.nit}','${_json.receptor.nrc}','${_json.receptor.nombre}','${_json.receptor.codActividad}','${_json.receptor.descActividad}','NULL','${_json.receptor.direccion.departamento}','${_json.receptor.direccion.municipio}','${_json.receptor.direccion.complemento}','${_json.receptor.telefono}','${_json.receptor.correo}')`,
      { type: QueryTypes.SELECT }
    );
  }

  //insertamos cuerpo documento
  for (let xx = 0; xx < _cuerpoDoc.length; xx++) {
    const element = _cuerpoDoc[xx];
    await sequelize.query(
      `insert into dte.dbo.cuerpoDocumento(dte_id,numItem,tipoItem,numeroDocumento,codigo,descripcion,cantidad,uniMedida,precioUni,montoDescu,ventaNoSuj,ventaExenta,ventaGravada,psv,noGravado) values (${_dteId},${element.numItem},${element.tipoItem},'${element.numeroDocumento}','${element.codigo}','${element.descripcion}',${element.cantidad},'${element.uniMedida}',${element.precioUni},${element.montoDescu},${element.ventaNoSuj},${element.ventaExenta},${element.ventaGravada},${element.psv},${element.noGravado})`,
      { type: QueryTypes.SELECT }
    );
    let _cuerpoDocId = 0;
    const cuerpoDocId = await sequelize.query(
      `select max(cuerpoDocumento_id) as id from dte.dbo.cuerpoDocumento where dte_id=${_dteId}`
    );
    if (cuerpoDocId.length > 0) {
      _cuerpoDocId = cuerpoDocId[0][0].id;
    } else {
      _cuerpoDocId = 1;
    }

    //const _cuerpoDoc_id = cuerpoDocId[0][0].id;
    for (let yy = 0; yy < element.tributos.length; yy++) {
      const element2 = element.tributos[yy];
      await sequelize.query(
        `insert into dte.dbo.tributoCuerpoDocumento(dte_id,cuerpoDocumento_id,item) values(${_dteId},${_cuerpoDocId},${element2})`,
        { type: QueryTypes.SELECT }
      );
    }
  }

  //insertamos el resumen del documento
  await sequelize.query(
    `insert into dte.dbo.resumen(dte_Id,totalNoSuj,totalExenta,totalGravada,subTotalVentas,descuNoSuj,descuExenta,descuGravada,porcentajeDescuento,totalDescu,subTotal,ivaPerci1,ivaRete1,reteRenta,montoTotalOperacion,totalNoGravado,totalPagar,totalLetras,saldoFavor,condicionOperacion) values (${_dteId},${
      _resumen.totalNoSuj
    },${_resumen.totalExenta},${_resumen.totalGravada},${
      _resumen.totalNoSuj + _resumen.totalExenta + _resumen.totalGravada
    },${_resumen.descuNoSuj},${_resumen.descuExenta},${_resumen.descuGravada},${
      _resumen.porcentajeDescuento
    },${_resumen.totalDescu},${_resumen.subTotal},${_resumen.ivaPerci1},${
      _resumen.ivaRete1
    },${_resumen.reteRenta},${_resumen.montoTotalOperacion},${
      _resumen.totalNoGravado
    },${_resumen.totalPagar},'${_resumen.totalLetras}',${_resumen.saldoFavor},${
      _resumen.condicionOperacion
    })`,
    { type: QueryTypes.SELECT }
  );

  const cuerpoId = await sequelize.query(
    `select Max(resumen_id) as id from dte.dbo.resumen where dte_id=${_dteId}`,
    { type: QueryTypes.SELECT }
  );

  const _cuerpoId = cuerpoId[0].id;
  //Insertamos en la tabla de tributoResumen
  for (let zz = 0; zz < _resumen.tributos.length; zz++) {
    const element3 = _resumen.tributos[zz];
    await sequelize.query(
      `insert into dte.dbo.tributoresumen(dte_Id,resumen_id,codigo,descripcion,valor) values (${_dteId},${_cuerpoId},'${element3.codigo}','${element3.descripcion}',${element3.valor})`,
      { type: QueryTypes.SELECT }
    );
  }

  //Insertamos en la tabla pagosResumen
  for (let a = 0; a < _resumen.pagos.length; a++) {
    const element4 = _resumen.pagos[a];
    await sequelize.query(
      `insert into dte.dbo.pagosresumen(dte_Id,resumen_id,codigo,montoPago,plazo,referencia,periodo) values (${_dteId},${_cuerpoId},'${element4.codigo}',${element4.montoPago},'${element4.plazo}','${element4.referencia}',${element4.periodo})`,
      { type: QueryTypes.SELECT }
    );
  }

  const dte = {
    identificacion,
    documentoRelacionado,
    emisor,
    receptor: _json.receptor,
    otrosDocumentos: _json.otrosDocumentos,
    ventaTercero: _json.ventaTercero,
    cuerpoDocumento: _cuerpoDoc,
    resumen: _resumen,
    extension: null,
    apendice: null,
  };

  //procedemos a recibir la firma del documento
  const datafirma = {
    nit: process.env.DTE_NIT,
    activo: true,
    passwordPri: process.env.DTE_PWD_PRIVADA,
    dteJson: dte,
  };

  const getFirma = async () => {
    try {
      const response = await fetch(`http://localhost:8113/firmardocumento/`, {
        body: JSON.stringify(datafirma),
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        method: "POST",
      });
      const data = await response.json();
      return data.body;
    } catch (error) {
      console.log(error);
    }
  };

  const _firma = await getFirma();

  //traermos la autorizacion de mh

  const getAuthMH = async () => {
    try {
      const response = await fetch(
        `https://apitest.dtes.mh.gob.sv/seguridad/auth`,
        {
          body: new URLSearchParams({
            user: process.env.DTE_USER_API,
            pwd: process.env.DTE_PWD_API,
          }),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          method: "POST",
        }
      );
      const data = await response.json();
      return data.body;
    } catch (error) {
      console.log(error);
    }
  };

  //consultamos el token si no esta vencido aun
  const _tokenEmpresa = await sequelize.query(
    `select tokenUser,fechaHoraToken from DTE.dbo.parametros where nit='${_nit}' `
  );

  const _fechaHoraToken = _tokenEmpresa[0][0].fechaHoraToken;
  let _token = _tokenEmpresa[0][0].tokenUser;

  //Guardamos en token para valdiarlo que esta activo aun
  const _diaHoraHoy = new Date();

  if (Date.parse(_diaHoraHoy) > Date.parse(_fechaHoraToken)) {
    console.log(Date.parse(_diaHoraHoy), Date.parse(_fechaHoraToken));
    const _auth = await getAuthMH();
    _token = _auth.token;

    const inserToken = await sequelize.query(
      "update DTE.dbo.parametros set tokenUser=(:_1), fechaHoraToken=getdate() where nit=(:_2)  ",
      {
        replacements: {
          _1: _token,
          _2: process.env.DTE_NIT,
        },
      },
      { type: QueryTypes.UPDATE }
    );
  }

  //enviamos el documento a la direccion del ministerio de Hacienda para que nos regrese el sello
  const dataMH = {
    ambiente: process.env.DTE_AMBIENTE,
    idEnvio: 1,
    version: parseInt(_version),
    tipoDte: _tipoDte,
    documento: _firma,
    codigoGeneracion: _codigoGeneracion,
    token: _token,
  };

  var myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", _token);

  var raw = JSON.stringify({
    ambiente: process.env.DTE_AMBIENTE,
    idEnvio: 1,
    version: parseInt(_version),
    tipoDte: _tipoDte,
    documento: _firma,
    codigoGeneracion: _codigoGeneracion,
  });

  var requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  const postrecepciondte = async () => {
    try {
      const response = await fetch(
        "https://apitest.dtes.mh.gob.sv/fesv/recepciondte",
        requestOptions
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.log("error", error);
    }
  };

  const _respuestaMH = await postrecepciondte();
  //guardamos en dte Respuesta ministerio
  await sequelize.query(
    `insert into dte.dbo.respuestamh(dte_Id,version,ambiente,estado,codigoGeneracion,selloRecibido,fhprocesamiento, clasificaMsg,codigoMsg,descripcionMsg) values (${_dteId},${_respuestaMH.version},'${_respuestaMH.ambiente}','${_respuestaMH.estado}','${_respuestaMH.codigoGeneracion}','${_respuestaMH.selloRecibido}','${_respuestaMH.fhProcesamiento}','${_respuestaMH.clasificaMsg}','${_respuestaMH.codigoMsg}','${_respuestaMH.descripcionMsg}')`,
    { type: QueryTypes.SELECT }
  );
  await sequelize.query(
    `update dte.dbo.dtes set estado='${_respuestaMH.estado}',selloRecibido='${_respuestaMH.selloRecibido}',updateDate='${_respuestaMH.fhProcesamiento}' where Dte_id=${_dteId}`,
    { type: QueryTypes.SELECT }
  );
  const respuestaMhId = await sequelize.query(
    `select Max(respuestamh_id) as id from dte.dbo.respuestamh where dte_id=${_dteId}`,
    { type: QueryTypes.SELECT }
  );

  let _respuestaMHId = 0;
  if (respuestaMhId.length > 0) {
    _respuestaMHId = respuestaMhId[0].id;
  } else {
    _respuestaMHId = 0;
  }
  for (let d = 0; d < _respuestaMH.observaciones.length; d++) {
    const el = _respuestaMH.observaciones[d];
    await sequelize.query(
      `insert into dte.dbo.observaciones(dte_id,respuestamh_id,descripcion) values (${_dteId},${_respuestaMHId},'${el}')`,
      { type: QueryTypes.SELECT }
    );
  }

  const JsonCliente = {
    identificacion,
    documentoRelacionado,
    emisor,
    receptor: _json.receptor,
    otrosDocumentos: _json.otrosDocumentos,
    ventaTercero: _json.ventaTercero,
    cuerpoDocumento: _cuerpoDoc,
    resumen: _resumen,
    extension: null,
    apendice: null,
    respuestaMh: _respuestaMH,
  };

  console.log("respuesta de Ministerio", _respuestaMH);
  res.send(JsonCliente);
  //res.send(dataMH);
};
function padTo2Digits(num) {
  return num.toString().padStart(2, "0");
}

function formatDate(date) {
  return (
    [
      date.getFullYear(),
      padTo2Digits(date.getMonth() + 1),
      padTo2Digits(date.getDate()),
    ].join("-") +
    " " +
    [
      padTo2Digits(date.getHours()),
      padTo2Digits(date.getMinutes()),
      padTo2Digits(date.getSeconds()),
    ].join(":")
  );
}
module.exports = { getPedido, getFactura };
