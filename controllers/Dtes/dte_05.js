const doc = require("pdfkit");
const {
  identificacion,
  emisor,
  receptor,
  firmaMH,
  autorizacionMh,
  apendice,
} = require("../../config/MH");
const {
  auxiliarCCModel,
  documentoModel,
  facturaModel,
} = require("../../models");
const moment = require("moment");
const { sequelize } = require("../../config/mssql");
const { QueryTypes } = require("sequelize");
const { NumeroLetras } = require("../../config/letrasNumeros");
const {
  guardarDte,
  guardarIdentificacion,
  guardarDocumentoRelacionas,
  guardarEmision,
  guardarReceptor,
  guardarcueroDocumento,
  guardarResumen,
  guardarTributoResumen,
  guardarPagoResumen,
  guardarRespuestaMH,
  updateDte,
  guardarObservacionesMH,
  guardarApendice,
  updateFacturaDte,
} = require("../../sqltx/Sqlguardar");
const {
  emailRechazo,
  emailEnviado,
  emailContingencia,
} = require("../../utils/email");

const fs = require("fs");
const path = require("path");
const {
  SqlFacturaLike,
  SqlFacturaLinea,
  SqlDocumentoCC,
  Sqlempresa,
  SqlFactura,
  SqlFacturaArticulo,
  SqlDte,
} = require("../../sqltx/sql");
const { generaPdf05, generaPdf } = require("../../utils/generaPdf");
const { type } = require("os");
const { send } = require("process");

//Nota Credito
const postDte05 = async (req, res) => {
 try {
  const _factura = req.params.factura;
  const _empresa = req.params.id;
  const _ano = process.env.ANO;
  const User = req.cliente;
  const empresa = await Sqlempresa(_empresa);
  let estado = "";
  if (!_factura) {
    return res.send({ messaje: "Es requerida Numero Factura", result: false });
  }

  const _docExit = await SqlDocumentoCC(_factura, empresa[0].esquemaBD);
  if (_docExit.length === 0) {
    return res.send({ messaje: "Documento no existe", result: false });
  }

  let Usuario;
  if (User === undefined) {
    Usuario = 1;
  } else {
    Usuario = User[0].usuario_id;
  }

  const HayContingencia = empresa[0].contingencia;
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
    });
  }

  const _dteProcesado = await SqlDte(_factura, _empresa);
  /*
  if (_dteProcesado.length > 0) {
    if (_dteProcesado[0].estado == "PROCESADO") {
      logger.info("Documento ya fue procesado", { controller: "dte_05", action: "postDte05" });
      return res.send({ messaje: "Documeto ya fue proceado", result: false });
    }
  }
    */

  const _identificacion = await identificacion("05", _empresa, _factura);
  const _docRela = await docRelacionados(_factura, empresa[0].esquemaBD);


  if (_docRela === undefined) {
     logger.warn("Problema en documento relacionado", { controller: "dte_05", action: "postDte05" });
    res.send({
      result: "error",
      success: false,
      errors: ["problema en documento relacionado"],
    });
    return;
  }

  const _emisor = await emisor(empresa, "05");
  const _receptor = await receptor(_factura, "05", empresa[0].esquemaBD);
  const _cuerpo = await cuerpoDoc(
    _factura,
    _docRela,
    empresa[0].esquemaBD,
    _empresa
  );
  const _cuerpoLote = await cuerpoDocLote(
    _factura,
    _docRela[0].numeroDocumento,
    empresa[0].esquemaBD,
    _empresa
  );
  const _resumen = await resumen(_factura, empresa[0].esquemaBD);
  const _extension = null;
  const _apendice = await apendice(
    _factura,
    "05",
    _docExit[0].SUBTIPO_DOC_CXC,
    empresa[0].esquemaBD
  );
  const _fechaFac = await SqlFactura(_factura, empresa[0].esquemaBD);
  let fechaFull = "";
  if (_fechaFac > 0) {
    fechaFull = _fechaFac[0].FECHAFULL;
  } else {
    const _docCC = await SqlDocumentoCC(_factura, empresa[0].esquemaBD);
    fechaFull = _docCC[0].FECHAFULL;
  }
  const dte = {
    identificacion: _identificacion,
    documentoRelacionado: _docRela,
    emisor: _emisor,
    receptor: _receptor,
    ventaTercero: null,
    cuerpoDocumento: _cuerpo,
    resumen: _resumen,
    extension: _extension,
    apendice: _apendice,
  };
  const datafirma = {
    nit: empresa[0].nit,
    activo: true,
    passwordPri: empresa[0].pwdPrivado,
    dteJson: dte,
  };

  if (HayContingencia) {
    estado = "CONTINGENCIA";
  } else {
    estado = "PENDIENTE";
  }
  const _firma = await firmaMH(datafirma, empresa);
  if (_firma == "ERROR") {
    //Se envia corre
    return res.send({
      messaje: "Es Servidor de Firma no responde",
      result: false,
    });
  }
  //guardamos en base de datos dte
  const dataDte = {
    dte: _factura,
    origen: "CLIENTE",
    nombre: _receptor.nombre,
    procesado: 0,
    modulo: "FA",
    tipoDoc: "05",
    selloRecibido: "ND",
    codigoGeneracion: _identificacion.codigoGeneracion,
    estado: estado,
    fechaemision: fechaFull,
    montoTotal: _resumen.totalGravada,
    Documento: _receptor.nit,
    Empresa_id: _empresa,
    firma: _firma,
    usuario_Id: Usuario,
  };

  await guardarDte(dataDte, _empresa);
  await guardarIdentificacion(_identificacion, _factura, _empresa);
  await guardarDocumentoRelacionas(_docRela, _factura, _empresa);
  await guardarEmision(_emisor, _factura, _empresa);
  await guardarReceptor(_receptor, _factura, _empresa);
  await guardarcueroDocumento(_cuerpoLote, _factura, "05", _empresa);
  await guardarResumen(_resumen, _factura, _empresa);
  await guardarTributoResumen(_resumen.tributos, _factura, _empresa);
  await guardarApendice(_factura, _docExit[0].SUBTIPO_DOC_CXC, _empresa);

  ///Realizamos firma
  if (!HayContingencia) {
    //Atutenticamos
    const _auth = await autorizacionMh(_empresa);

    if (_auth == "ERROR") {
      //Se envia corre
      return res.send({
        messaje: "Es Servidor de Autenticacion no responde de hacienda",
        result: false,
      });
    } else if (_auth.estado == "RECHAZADO") {
      return res.send({
        messaje: "Problema con autenicacion",
        result: false,
      });
    }
    let _token = "";
    _token = _auth.token;

    //enviamos el documento a la direccion del ministerio de Hacienda para que nos regrese el sello
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", _token);

    var raw = JSON.stringify({
      ambiente: empresa[0].ambiente,
      idEnvio: 1,
      version: _identificacion.version,
      tipoDte: _identificacion.tipoDte,
      documento: _firma,
      codigoGeneracion: _identificacion.codigoGeneracion,
    });

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const postrecepciondte = async () => {
      try {
        if (empresa[0].ambiente === "00") {
          const response = await fetch(
            "https://apitest.dtes.mh.gob.sv/fesv/recepciondte",
            requestOptions
          );
          const data = await response.json();
          return data;
        }
        if (empresa[0].ambiente === "01") {
          const response = await fetch(
            "https://api.dtes.mh.gob.sv/fesv/recepciondte",
            requestOptions
          );
          const data = await response.json();
	   logger.info("Respuesta MH data", { controller: "dte_05", action: "postDte05" });
          return data;
        }
      } catch (error) {
        logger.error("Error interno", { controller: "dte_05", action: "postDte05" });
      }
    };

    const _dteProcesado = await SqlDte(_factura, empresa[0].Empresa_id);
    if (_dteProcesado.length > 0) {
      if (_dteProcesado[0].estado == "PROCESADO") {
        await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
          {
            type: QueryTypes.SELECT,
          }
        );
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }
    const _respuestaMH = await postrecepciondte();
logger.info("Respuesta MH", { controller: "dte_05", action: "postDte05" })
    await guardarRespuestaMH(_respuestaMH, _factura, _empresa);
    await updateDte(_respuestaMH, _factura, _empresa);
    await updateFacturaDte(_factura, empresa);
         
await guardarObservacionesMH(
      _respuestaMH.observaciones,
      _factura,
      _empresa
    );
    await guardarObservacionesMH(
      [_respuestaMH.descripcionMsg],
      _factura,
      _empresa
    );

    const JsonCliente = {
      identificacion: _identificacion,
      documentoRelacionado: _docRela,
      emisor: _emisor,
      receptor: _receptor,
      ventaTercero: null,
      cuerpoDocumento: _cuerpo,
      resumen: _resumen,
      extension: null,
      apendice: null,
      respuestamh: _respuestaMH,
    };

    if (
      _respuestaMH.estado === "RECHAZADO" &&
      _respuestaMH.codigoMsg === "004"
    ) {
      await sequelize.query(
        `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa} `,
        {
          type: QueryTypes.SELECT,
        }
      );
      return;
    } else {
      if (_respuestaMH.estado === "RECHAZADO") {
        try {
          //  await fac01(_factura);

          const fileName = path.join(
            __dirname,
            `../../storage/json/${empresa[0].esquemaBD}/dte05/rechazados/${_ano}/`
          );
          const newfile = fileName + `${_identificacion.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _identificacion.numeroControl,
            "factura@coagro.com",
            "dte05",
            _ano,
            empresa[0].esquemaBD
          );
          await sequelize.query(
            `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
            {
              type: QueryTypes.SELECT,
            }
          );
          res.send({
            messaje: "Procesado en Hacienda Rechazado",
            success: true,
            result: "Procesado en Hacienda Rechazado",
            errors: ["Procesado en Hacienda Rechazado"],
            hacienda: false,
          });
          return;
        } catch (error) {
          logger.error("Error capturado", { controller: "dte_05", action: "postDte05" });
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado == "PROCESADO") {
        //enviasmos correo a cliente y pdf

        //await fac01(_factura);
        await generaPdf05(_factura, _ano, _empresa);
        setTimeout(function () {
          logger.info("Procedemos a enviarlos", { controller: "dte_05", action: "postDte05" });
        }, 1000);
        const fileName = path.join(
          __dirname,
          `../../storage/json/${empresa[0].esquemaBD}/dte05/aceptados/${_ano}/`
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        if (empresa[0].ambiente === "00") {
          await emailEnviado(
            _identificacion.numeroControl,
            "cvelasquez@h2cgroup.com",
            "factura@coagro.com",
            _receptor.nombre,
            "dte05",
            _ano,
            _empresa
          );
        }
        if (empresa[0].ambiente === "01") {
          await emailEnviado(
            _identificacion.numeroControl,
            _receptor.correo,
            "factura@coagro.com",
            _receptor.nombre,
            "dte05",
            _ano,
            _empresa
          );
          await sequelize.query(
            `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
            {
              type: QueryTypes.SELECT,
            }
          );
        }

        res.send({
          errors: ["Procesado en Hacienda Aceptados"],
          result: "Procesado en Hacienda Aceptados",
          success: true,
          hacienda: true,
        });
        return;
      }
    }
  } else {
    const JsonCliente = {
      identificacion: _identificacion,
      documentoRelacionado: null,
      emisor: _emisor,
      receptor: _receptor,
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento: _cuerpo,
      resumen: _resumen,
      extension: null,
      apendice: _apendice,
      firma: _firma,
    };

    //enviasmos correo a cliente y pdf

    //await fac01(_factura);
    const fileName = path.join(
      __dirname,
      `../../storage/json/${empresa[0].esquemaBD}/dte05/contingencia/${_ano}/`
    );
    const newfile = fileName + `${_identificacion.numeroControl}.json`;

    fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
    await emailContingencia(
      _identificacion.numeroControl,
      "factura@coagro.com",
      "dte05",
      _ano,
      User[0].empresa
    );
    await sequelize.query(
      `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
      {
        type: QueryTypes.SELECT,
      }
    );
    res.send({
      messaje: "Procesado en Contingencia",
      result: true,
      hacienda: true,
    });
  }
 } catch (error) {
   await notifyError("dte_05", "postDte05", error);
   if (res && !res.headersSent) {
     res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
   }
 }
};
const docRelacionados = async (datos, esquema) => {
  try {
    const _documentosCC = await sequelize.query(
      `EXEC dte.dbo.dte_DocumentosCC '${datos}','${esquema}'`,
      {
        type: QueryTypes.SELECT,
      }
    );


    const docus = _documentosCC[0].APLICACION;
   logger.debug("Debug documento", { controller: "dte_05", action: "postDte05" });
    const dataccf = await buscarCCF(docus, esquema);

    if (dataccf.length === 0) return;
    const datosRelacionados = [];
    for (let x = 0; x < dataccf.length; x++) {
      const element = dataccf[x];
      const _docu = await sequelize.query(
        `EXEC dte.dbo.dte_DocumentosCC '${element.DOCUMENTO}','${esquema}'`,
        {
          type: QueryTypes.SELECT,
        }
      );

      if (_docu[0].CARGADO_DE_FACT === "S") {
        const factura = await sequelize.query(
          `EXEC dte.dbo.dte_Factura '${element.DOCUMENTO}','${esquema}'`,
          {
            type: QueryTypes.SELECT,
          }
        );

        const date = moment(new Date(factura[0].FECHAFULL));
        const momentDate = moment(date).format("YYYY-MM-DD");
        let tipoGen = 0;

        if (factura[0].DOCUMENTO.substring(0, 6) === "DTE-03") {
          tipoGen = 2;
          const _factura00 = factura[0].DOCUMENTO;
          const dataFactura = {
            tipoDocumento: "03",
            tipoGeneracion: tipoGen,
            numeroDocumento: factura[0].DOC_FISCAL,
            fechaEmision: momentDate,
          };

          datosRelacionados.push(dataFactura);
        } else {
          tipoGen = 1;
          const _factura00 = factura[0].DOCUMENTO;
          const dataFactura = {
            tipoDocumento: "03",
            tipoGeneracion: tipoGen,
            numeroDocumento: factura[0].DOCUMENTO,
            fechaEmision: momentDate,
          };
          datosRelacionados.push(dataFactura);
        }
      } else {
        const documentosCC = await sequelize.query(
          `EXEC dte.dbo.dte_DocumentosCC '${element.DOCUMENTO}','${esquema}'`,
          {
            type: QueryTypes.SELECT,
          }
        );

        let tipoGen = 0;
        if (documentosCC[0].DOCUMENTO.substring(0, 6) === "DTE-05") {
          tipoGen = 2;
        } else {
          tipoGen = 1;
        }

        const dataFactura = {
          tipoDocumento: "03",
          tipoGeneracion: tipoGen,
          numeroDocumento: documentosCC[0].DOCUMENTO,
          fechaEmision: moment(documentosCC[0].FECHA_DOCUMENTO).format(
            "YYYY-MM-DD"
          ),
        };
        datosRelacionados.push(dataFactura);
      }
    }
    return datosRelacionados;
  } catch (error) {
    logger.error("Error capturado", { controller: "dte_05", action: "postDte05" });
  }
};

const cuerpoDoc = async (_factura, _documento, esquema, empresa_id) => {
  const _documentosCC = await sequelize.query(
    `EXEC dte.dbo.dte_DocumentosCC '${_factura}','${esquema}'`,
    {
      type: QueryTypes.SELECT,
    }
  );

  if (_documentosCC[0].CARGADO_DE_FACT === "S") {
    const _cuerpoDoc = [];
    let corre = 0;

    const _doc = await SqlFacturaLinea(_factura, esquema);

    for (let x = 0; x < _doc.length; x++) {
      const element = _doc[x];
      const decLinea = element.DESC_TOT_LINEA;
      const decVolumen = element.DESCUENTO_VOLUMEN;
      const totalDesc = decLinea + decVolumen;
      const precio = element.PRECIO_UNITARIO;
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      const _articulo = element.ARTICULO;
      //Buscar enque docuemento esta este articulo
      let docuRelacionado = "";
      let _numeroControl = "";
      for (let y = 0; y < _documento.length; y++) {
        const elementdoc = _documento[y];

        if (elementdoc.numeroDocumento.length >= 30) {
          const dat = await sequelize.query(
            `select dte from dte.dbo.dtes where codigoGeneracion='${elementdoc.numeroDocumento}' and Empresa_id='${empresa_id}'`,
            {
              type: QueryTypes.SELECT,
            }
          );

          _numeroControl = elementdoc.numeroDocumento;
        } else {
          _numeroControl = elementdoc.numeroDocumento;
        }
        const data = await SqlFacturaArticulo(_factura, _articulo, esquema);

        if (data.length > 0) {
          docuRelacionado = data[0].FACTURA.replace("-24-", "-");
          break;
        }
      }

      corre = corre + 1;
      const data = {
        numItem: corre,
        tipoItem: 1,
        numeroDocumento: _numeroControl,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: element.DESCRIPCION,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: parseFloat(element.PRECIO_UNITARIO.toFixed(4)),
        montoDescu: totalDesc,
        ventaNoSuj: 0.0,
        ventaExenta: 0.0,
        ventaGravada: parseFloat(ventagravada.toFixed(4)),
        tributos: ["20"],
      };
      _cuerpoDoc.push(data);
    }
    return _cuerpoDoc;
  } else {
    const _cuerpoDoc = [];
    let corre = 0;
    const _doc = await SqlDocumentoCC(_factura, esquema);

    if (_documento === undefined) return;
    for (let x = 0; x < _doc.length; x++) {
      const element = _doc[x];
      corre = corre + 1;
      const data = {
        numItem: corre,
        tipoItem: 1,
        numeroDocumento: _documento[0].numeroDocumento,
        codigo: null,
        codTributo: null,
        descripcion: element.APLICACION,
        cantidad: 1,
        uniMedida: 59,
        precioUni: parseFloat(element.SUBTOTAL.toFixed(4)),
        montoDescu: 0,
        ventaNoSuj: 0.0,
        ventaExenta: 0.0,
        ventaGravada: parseFloat(element.SUBTOTAL.toFixed(4)),
        tributos: ["20"],
      };
      _cuerpoDoc.push(data);
    }
    return _cuerpoDoc;
  }
};

const cuerpoDocLote = async (_factura, _documento, esquema,empresa_id) => {
  try {
    const _documentosCC = await sequelize.query(
      `EXEC dte.dbo.dte_docRelacionados '${_factura}','${esquema}'`,
      {
        type: QueryTypes.SELECT,
      }
    );

    if (_documentosCC[0].CARGADO_DE_FACT === "S") {
      const dataFacLinea = await sequelize.query(
        `EXEC dte.dbo.dte_FacturaLinea '${_factura}','${esquema}'`,
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

        let _tributo = "";
        if (parseFloat(ventagravada.toFixed(4)) == 0) {
          _tributo = null;
        } else {
          _tributo = ["20"];
        }

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
          tributos: _tributo,
          psv: 0.0,
          noGravado: 0,
          lote: element.LOTE,
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

      return _cuerpoDoc;
    } else {
      const _cuerpoDoc = [];
      let corre = 0;
      const _doc = await SqlDocumentoCC(_factura,esquema);

      for (let x = 0; x < _doc.length; x++) {
        const element = _doc[x];
        corre = corre + 1;
        const data = {
          numItem: corre,
          tipoItem: 1,
          numeroDocumento: _documento,
          codigo: "ND",
          codTributo: null,
          descripcion: element.APLICACION,
          cantidad: 1,
          uniMedida: 59,
          precioUni: parseFloat(element.SUBTOTAL.toFixed(4)),
          montoDescu: 0,
          ventaNoSuj: 0.0,
          ventaExenta: 0.0,
          ventaGravada: parseFloat(element.SUBTOTAL.toFixed(4)),
          tributos: ["20"],
          noGravado: 0,
          lote: "ND",
        };
        _cuerpoDoc.push(data);
      }
      return _cuerpoDoc;
    }
  } catch (error) {
    logger.error("Error capturado", { controller: "dte_05", action: "postDte05" });
  }
};

const resumen = async (_documento, esquema) => {
  try {
    const _fac = await SqlFactura(_documento, esquema);
    if (_fac.length > 0) {
      const _facL = await SqlFacturaLinea(_documento, esquema);
      let totalDescuento = 0;
      for (let index = 0; index < _facL.length; index++) {
        const element = _facL[index];
        totalDescuento =
          totalDescuento + (element.DESC_TOT_LINEA + element.DESCUENTO_VOLUMEN);
      }

      const _resumen = {
        totalNoSuj: 0.0,
        totalExenta: 0.0,
        totalGravada: parseFloat(_fac[0].totalGravada.toFixed(2)),
        subTotalVentas: parseFloat(_fac[0].subTotalVentas.toFixed(2)),
        descuNoSuj: 0.0,
        descuExenta: 0.0,
        descuGravada: 0.0,
        totalDescu: parseFloat(totalDescuento.toFixed(2)),
        tributos: [
          {
            codigo: "20",
            descripcion: "Impuesto al Valor Agregado 13%",
            valor: parseFloat(_fac[0].totalImpuesto.toFixed(2)),
          },
        ],
        subTotal: parseFloat(_fac[0].subTotal.toFixed(2)),
        ivaPerci1: parseFloat(_fac[0].totalPercibido.toFixed(2)),
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: parseFloat(_fac[0].totalPagar.toFixed(2)),
        totalLetras:
          NumeroLetras(parseFloat(_fac[0].totalPagar.toFixed(2))) + " USD",
        condicionOperacion: 1,
      };
      return _resumen;
    } else {
      const _documentosCC = await sequelize.query(
        `EXEC dte.dbo.dte_docRelacionados '${_documento}','${esquema}'`,
        {
          type: QueryTypes.SELECT,
        }
      );

      const totalOperac = parseFloat(
        _documentosCC[0].BASE_IMPUESTO1 +
          _documentosCC[0].IMPUESTO1 +
          _documentosCC[0].IMPUESTO2
      );
      const _resumen = {
        totalNoSuj: 0.0,
        totalExenta: 0.0,
        totalGravada: parseFloat(_documentosCC[0].BASE_IMPUESTO1.toFixed(2)),
        subTotalVentas: parseFloat(_documentosCC[0].BASE_IMPUESTO1.toFixed(2)),
        descuNoSuj: 0.0,
        descuExenta: 0.0,
        descuGravada: 0.0,
        totalDescu: 0,
        tributos: [
          {
            codigo: "20",
            descripcion: "Impuesto al Valor Agregado 13%",
            valor: parseFloat(_documentosCC[0].IMPUESTO1.toFixed(2)),
          },
        ],
        subTotal: parseFloat(_documentosCC[0].BASE_IMPUESTO1.toFixed(2)),
        ivaPerci1: parseFloat(_documentosCC[0].IMPUESTO2.toFixed(2)),
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: parseFloat(totalOperac.toFixed(2)),
        totalLetras: NumeroLetras(parseFloat(totalOperac.toFixed(2))) + " USD",

        condicionOperacion: 1,
      };
      return _resumen;
    }
  } catch (error) {
    logger.error("Error capturado", { controller: "dte_05", action: "postDte05" });
  }
};
const buscarCCF = async (ccf, esquema) => {
  try {
    const arryDoc = [];
    const arr = ccf.split(" ");

    for (let index = 0; index < arr.length; index++) {
      const element = arr[index];
      if (element.match("CF")) {
        const _factura = await SqlFactura(element, esquema);

        if (_factura.length > 0) {
          arryDoc.push(_factura[0]);
        }
      }

      if (element.match("DTE-03")) {
        //DTE-03-00000000-24-000000000000460.
        //DTE-03-24-12545
        const tipo = element.substring(0, 6);
        const segmento2 = element.substring(7, 15);
        const ano = element.substring(16, 18);
        const corre = element.substring(19, 33);
        const core2 = corre.padStart(15, "0");
        const newConsecutivo = tipo + "-" + segmento2 + "-" + ano + "-" + core2;
        logger.debug("Debug consecutivo", { controller: "dte_05", action: "postDte05" })
        const _factura = await SqlFactura(newConsecutivo, esquema);

        if (_factura.length > 0) {
          arryDoc.push(_factura[0]);
        }
      }
    }

    return arryDoc;
  } catch (error) {
    logger.error("Error capturado", { controller: "dte_05", action: "postDte05" });
  }
};
module.exports = postDte05;

