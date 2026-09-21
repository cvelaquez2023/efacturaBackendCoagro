const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { NumeroLetras } = require("../../config/letrasNumeros");
const Sql = require("../../sqltx/sql");

const {
  firmaMH,
  autorizacionMh,
  identificacion,
  emisor,
  receptor,
  apendice,
} = require("../../config/MH");
const { emailRechazo, emailEnviado } = require("../../utils/email");
const fs = require("fs");
const path = require("path");
const { transporter } = require("../../config/mailer");
const {
  guardarIdentificacion,
  guardarEmision,
  guardarReceptor,
  guardarcueroDocumento,
  guardarRespuestaMH,
  guardarTributoResumen,
  guardarPagoResumen,
  updateDte,
  guardarObservacionesMH,
  guardarDte,
  guardarResumen,
  guardarApendice,
  updateFacturaDte,
} = require("../../sqltx/Sqlguardar");
const generaPdf = require("../../utils/generaPdf");
const { generaPdfTicket } = require("../../utils/pdfMakeTicket");

//Factura
const postDte01 = async (req, res) => {
 try {
  const _factura = req.params.factura;
  const _empresa = req.params.id;
  const _ano = process.env.ANO;
  const User = req.cliente;

  const empresa = await Sql.Sqlempresa(_empresa);
  
  let estado = "";
  if (!_factura) {
    return res.send({
      messaje: "Es requerida Numero Factura",
      result: false,
    });
  }
  const _docExit = await Sql.SqlFactura(_factura, empresa[0].esquemaBD);
  if (_docExit.length === 0) {
    return res.send({ messaje: "Documento no existe Dte 01", result: false });
  }


  let Usuario;
  if (User === undefined) {
    Usuario = 1;
  } else {
    Usuario = User[0].usuario_id;
  }

  const HayContingencia = empresa[0].Contingencia;
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
    });
  }

  const _identificacion = await identificacion("01", _empresa, _factura);

  const _documentoRelacionado = null;
  const _emisor = await emisor(empresa, "01");
  const _receptor = await receptor(_factura, "01", empresa[0].esquemaBD);
  const _otrosDocumentos = null;
  const _ventaTercero = null;
  const _cuerpo = await cuerpoDoc(
    _factura,
    _docExit[0].observaciones,
    _docExit[0].SUBTIPO_DOC_CXC,
    empresa[0].esquemaBD
  );

  const _cuerpoLote = await cuerpoDoclote(
    _factura,
    _docExit[0].observaciones,
    _docExit[0].SUBTIPO_DOC_CXC,
    empresa[0].esquemaBD
  );

  const _resumen = await resumen(_factura, empresa[0].esquemaBD);

  const _extension = null;
  const _apendice = await apendice(
    _factura,
    _docExit[0].SUBTIPO_DOC_CXC,
    "01",
    empresa[0].esquemaBD
  );

  const _fechaFac = await Sql.SqlFactura(_factura, empresa[0].esquemaBD);
  const _vendedor = await Sql.SqlVendedorCodigo(
    _fechaFac[0].VENDEDOR,
    empresa[0].esquemaBD
  );
  let _correoVendedor;
  if (_vendedor[0].e_mail != null) {
    _correoVendedor = _vendedor[0].e_mail;
  } else {
    _correoVendedor = "factura@coagro.com";
  }

  const dte = {
    identificacion: _identificacion,
    documentoRelacionado: _documentoRelacionado,
    emisor: _emisor,
    receptor: _receptor,
    otrosDocumentos: _otrosDocumentos,
    ventaTercero: _ventaTercero,
    cuerpoDocumento: _cuerpo,
    resumen: _resumen,
    extension: _extension,
    apendice: _apendice,
  };
  //procedemos a recibir la firma del documento
  //convertimos descodificamos firma
  logger.debug("Debug dte", { controller: "dte_01", action: "postDte01" });
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

  const dataDte = {
    dte: _factura,
    origen: "CLIENTE",
    nombre: _receptor.nombre,
    procesado: 0,
    modulo: "FA",
    tipoDoc: "01",
    selloRecibido: "ND",
    codigoGeneracion: _identificacion.codigoGeneracion,
    estado: estado,
    fechaemision: _fechaFac[0].FECHAFULL,
    montoTotal: _resumen.totalGravada,
    Documento: _receptor.numDocumento,
    Empresa_id: _empresa,
    firma: _firma,
    usuario_Id: Usuario,
  };

  await guardarDte(dataDte, _empresa);
  await guardarIdentificacion(_identificacion, _factura, _empresa);
  await guardarEmision(_emisor, _factura, _empresa);
  await guardarReceptor(_receptor, _factura, _empresa);
  await guardarcueroDocumento(_cuerpoLote, _factura, "01", _empresa);
  await guardarResumen(_resumen, _factura, _empresa);
  await guardarTributoResumen(_resumen.tributos, _factura, _empresa);
  await guardarPagoResumen(_resumen.pagos, _factura, _empresa);
  await guardarApendice(_factura, _docExit[0].SUBTIPO_DOC_CXC, _empresa);

  if (!HayContingencia) {
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
          return data;
        }
      } catch (error) {
        logger.error("Error interno", { controller: "dte_01", action: "postDte01" });
      }
    };

    const _dteProcesado = await Sql.SqlDte(_factura, empresa[0].Empresa_id);
    if (_dteProcesado.length > 0) {
      if (_dteProcesado[0].estado == "PROCESADO") {
        await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
          {
            type: QueryTypes.SELECT,
          }
        );
        logger.info("Documento ya fue procesado", { controller: "dte_01", action: "postDte01" });
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }
    const _respuestaMH = await postrecepciondte();
    await guardarRespuestaMH(_respuestaMH, _factura, _empresa);
    await updateDte(_respuestaMH, _factura, _empresa);
    await updateFacturaDte(_factura, empresa);
    await guardarObservacionesMH(
      _respuestaMH.observaciones,
      _factura,
      _empresa
    );
    const JsonCliente = {
      identificacion: _identificacion,
      documentoRelacionado: _documentoRelacionado,
      emisor: _emisor,
      receptor: _receptor,
      otrosDocumentos: _otrosDocumentos,
      ventaTercero: _ventaTercero,
      cuerpoDocumento: _cuerpo,
      resumen: _resumen,
      extension: _extension,
      apendice: _apendice,
      respuestaMh: _respuestaMH,
      firma: _firma,
    };
    //console.log(JsonCliente);
    logger.info("Respuesta MH recibida", { controller: "dte_01", action: "postDte01" });
    if (_respuestaMH.codigoMsg === "004") {
      return;
    }

    if (_respuestaMH.estado === "RECHAZADO") {
      try {
        const fileName = path.join(
          __dirname,
          `../../storage/json/${empresa[0].esquemaBD}/dte01/rechazados/${_ano}/`
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        await emailRechazo(
          _identificacion.numeroControl,
          "factura@coagro.com",
          "dte01",
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
        logger.error("Error capturado", { controller: "dte_01", action: "postDte01" });
      }
    } else {
      if (_respuestaMH.estado === "RECHAZADO") {
        try {
          //  await fac01(_factura);

          const fileName = path.join(
            __dirname,
            `../../storage/json/${empresa[0].esquemaBD}/dte01/rechazados/${_ano}/`
          );
          const newfile = fileName + `${_identificacion.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _identificacion.numeroControl,
            "factura@coagro.com",
            //"rechazosdte@drogueriauniversal.com",
            "dte01",
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
            errors: ["Procesado en Hacienda Rechazado"],
            result: true,
            success: false,
            hacienda: false,
          });
          return;
        } catch (error) {
          logger.error("Error capturado", { controller: "dte_01", action: "postDte01" });
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado === "PROCESADO") {
        //enviasmos correo a cliente y pdf

        if (empresa[0].formato === "T") {
          await generaPdfTicket(_factura, _ano, _empresa);
        } else {
          await generaPdf.generaPdf(_factura, _ano, _empresa);
        }
        setTimeout(function () {
          logger.info("Procedemos a enviarlos", { controller: "dte_01", action: "postDte01" });
        }, 1000);

        //await fac03(_factura);
        //await fac01(_factura);
        const fileName = path.join(
          __dirname,
          `../../storage/json/${empresa[0].esquemaBD}/dte01/aceptados/${_ano}/`
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        let _correo = "";
        if (_receptor.correo == undefined || _receptor.correo == null) {
          _correo = "factura@coagro.com";
        } else {
          _correo = _receptor.correo;
        }
        if (empresa[0].ambiente === "00") {
          await emailEnviado(
            _identificacion.numeroControl,
            "cvelasquez@h2cgroup.com",
            "demodte@gmail.com",
            _receptor.nombre,
            "dte01",
            _ano,
            _empresa
          );
        }
        if (empresa[0].ambiente === "01") {
          await emailEnviado(
            _identificacion.numeroControl,
            _correo,
            _correoVendedor,
            _receptor.nombre,
            "dte01",
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
          messaje: "Procesado en Hacienda Aceptados",
          errors: ["Procesado en Hacienda Aceptados"],
          success: true,
          result: true,
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
      apendice: null,
      firma: _firma,
    };
    //  await fac01(_factura);
    const fileName = path.join(
      __dirname,
      `../../storage/json/${empresa[0].esquemaBD}/dte01/contingencia/${_ano}/`
    );
    const newfile = fileName + `${_identificacion.numeroControl}.json`;

    fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
    await emailEnviado(
      _identificacion.numeroControl,
      _receptor.correo,
      "dte01",
      _ano,
      _empresa
    );

    res.send({
      messaje: "Procesado en Contingencia",
      result: true,
      hacienda: false,
    });
  }
 } catch (error) {
   await notifyError("dte_01", "postDte01", error);
   if (res && !res.headersSent) {
     res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
   }
 }
};
const cuerpoDoc = async (_factura, obser, tipo, esquema) => {
  if (tipo == 110) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLineaLicitaciones '${_factura}','${esquema}'`,
      { type: QueryTypes.SELECT }
    );

    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = dataFacLinea[0].TOTAL_IMPUESTO1;
    let precioTotal = dataFacLinea[0].PRECIO_TOTAL;
    let ventatotalGravada = 0;
    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const precio =
        (dataFacLinea[0].PRECIO_TOTAL + dataFacLinea[0].TOTAL_IMPUESTO1) /
        dataFacLinea[0].CANTIDAD;
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen =
        element.DESCUENTO_VOLUMEN * parseFloat(process.env.DTE_IMPUESTO);
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;
      let exento = 0;
      let gravada = 0;

      if (element.IMPUESTO === "4") {
        exento = parseFloat(ventagravada.toFixed(4));
        gravada = 0;
      } else {
        gravada = parseFloat(ventagravada.toFixed(4));
        exento = 0;
      }
      const descrip = element.DESCRIPCION + obser;
      const data = {
        numItem: 1,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: descrip.substring(0, 1000),
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: parseFloat(precio.toFixed(4)),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: exento,
        ventaGravada: gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
  if (tipo === 51) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLinea51 '${_factura}','${esquema}'`,
      { type: QueryTypes.SELECT }
    );

    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = 0;
    let ventatotalGravada = 0;
    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const precio =
        element.PRECIO_UNITARIO * parseFloat(process.env.DTE_IMPUESTO);
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen =
        element.DESCUENTO_VOLUMEN * parseFloat(process.env.DTE_IMPUESTO);
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;

      const data = {
        numItem: element.LINEA,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: element.DESCRIPCION,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: parseFloat(precio.toFixed(4)),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: 0.0,
        ventaGravada: parseFloat(ventagravada.toFixed(4)),
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
  if (tipo === 10) {
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
      const precio =
        element.PRECIO_UNITARIO ;
      const decLinea =
        element.DESC_TOT_LINEA ;
      const decVolumen =
        element.DESCUENTO_VOLUMEN ;
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;
      let _exenta = 0;
      let _gravada = 0;
      let _impuesto1 = 0;
      let _preciUni = 0;
      _exenta = parseFloat(element.PRECIO_TOTAL.toFixed(4));
      _gravada = 0.0;
      _impuesto1 = 0;
      _preciUni = parseFloat(element.PRECIO_UNITARIO.toFixed(4));

      const data = {
        numItem: element.LINEA,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: element.DESCRIPCION,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: _preciUni,
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: _exenta,
        ventaGravada: _gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: _impuesto1,
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  } else {
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
      const ivaUni = element.TOTAL_IMPUESTO1 / element.CANTIDAD;
      const precio = (element.PRECIO_UNITARIO + ivaUni).toFixed(4);
      const decLinea = element.DESC_TOT_LINEA;
      const decVolumen = element.DESCUENTO_VOLUMEN;
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * parseFloat(cantidad);
      const ventagravada = parseFloat(precioTotal) - parseFloat(totalDesc);

      if (element.IMPUESTO === "4") {
        exento = parseFloat(ventagravada.toFixed(4));
        gravada = 0;
      } else {
        gravada = parseFloat(ventagravada.toFixed(4));
        exento = 0;
      }

      let _tributo = null;
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
        precioUni: parseFloat(precio),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: exento,
        ventaGravada: gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
};

const cuerpoDoclote = async (_factura, obser, tipo, esquema) => {
  if (tipo === 47) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLineaLicitaciones '${_factura}','${esquema}'`,
      { type: QueryTypes.SELECT }
    );

    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = dataFacLinea[0].TOTAL_IMPUESTO1;
    let precioTotal = dataFacLinea[0].PRECIO_TOTAL;
    let ventatotalGravada = 0;
    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const precio =
        (dataFacLinea[0].PRECIO_TOTAL + dataFacLinea[0].TOTAL_IMPUESTO1) /
        dataFacLinea[0].CANTIDAD;
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen = element.DESCUENTO_VOLUMEN;
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;
      const descri = element.DESCRIPCION + obser;
      if (element.IMPUESTO === "4") {
        exento = parseFloat(ventagravada.toFixed(4));
        gravada = 0;
      } else {
        gravada = parseFloat(ventagravada.toFixed(4));
        exento = 0;
      }
      const data = {
        numItem: 1,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: descri.substring(0, 1000),
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: parseFloat(precio.toFixed(4)),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: exento,
        ventaGravada: gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
        lote: "ND",
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
  if (tipo === 51) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLinea51 '${_factura}','${esquema}'`,
      { type: QueryTypes.SELECT }
    );

    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = 0;
    let ventatotalGravada = 0;
    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const precio =
        element.PRECIO_UNITARIO * parseFloat(process.env.DTE_IMPUESTO);
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen =
        element.DESCUENTO_VOLUMEN * parseFloat(process.env.DTE_IMPUESTO);
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;

      const data = {
        numItem: element.LINEA,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: element.DESCRIPCION,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: parseFloat(precio.toFixed(4)),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: 0.0,
        ventaGravada: parseFloat(ventagravada.toFixed(4)),
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
        lote: "ND",
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
  if (tipo === 10) {
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
      const precio =
        element.PRECIO_UNITARIO * parseFloat(process.env.DTE_IMPUESTO);
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen =
        element.DESCUENTO_VOLUMEN * parseFloat(process.env.DTE_IMPUESTO);
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;
      let _exenta = 0;
      let _gravada = 0;
      let _impuesto1 = 0;
      let _preciUni = 0;

      //_exenta = parseFloat(element.PRECIO_TOTAL.toFixed(4));
      //_gravada = 0.0;
      _impuesto1 = 0;
      _preciUni = parseFloat(element.PRECIO_UNITARIO.toFixed(4));

      if (element.IMPUESTO === "4") {
        exento = parseFloat(ventagravada.toFixed(4));
        gravada = 0;
      } else {
        gravada = parseFloat(ventagravada.toFixed(4));
        exento = 0;
      }
      const data = {
        numItem: element.LINEA,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: element.ARTICULO,
        codTributo: null,
        descripcion: element.DESCRIPCION,
        cantidad: element.CANTIDAD,
        uniMedida: 59,
        precioUni: _preciUni,
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: exento,
        ventaGravada: gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: _impuesto1,
        lote: "ND",
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  } else {
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
      const precio =
        element.PRECIO_UNITARIO * parseFloat(process.env.DTE_IMPUESTO);
      const decLinea =
        element.DESC_TOT_LINEA * parseFloat(process.env.DTE_IMPUESTO);
      const decVolumen =
        element.DESCUENTO_VOLUMEN * parseFloat(process.env.DTE_IMPUESTO);
      const totalDesc = parseFloat(decLinea + decVolumen);
      const cantidad = element.CANTIDAD;
      const precioTotal = precio * cantidad;
      const ventagravada = precioTotal - totalDesc;
      let _tributo = null;
      let exento = 0;
      let gravada = 0;
      if (element.IMPUESTO === "4") {
        exento = parseFloat(ventagravada.toFixed(4));
      } else {
        gravada = parseFloat(ventagravada.toFixed(4));
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
        precioUni: parseFloat(precio.toFixed(4)),
        montoDescu: parseFloat(totalDesc.toFixed(4)),
        ventaNoSuj: 0.0,
        ventaExenta: exento,
        ventaGravada: gravada,
        tributos: _tributo,
        psv: 0.0,
        noGravado: 0,
        ivaItem: parseFloat(element.TOTAL_IMPUESTO1.toFixed(4)),
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

    const _totalPagar = totalLinea - totalDescuento;
    return _cuerpoDoc;
  }
};
const resumen = async (_documento, esquema) => {
  const _fac = await Sql.SqlFactura(_documento, esquema);
  const _facL = await Sql.SqlFacturaLinea(_documento, esquema);
  const _ret = await Sql.SqlFacturaRet(_documento, esquema);

  let ret = 0;
  if (_ret.length > 0) {
    ret = parseFloat(_ret[0].MONTO.toFixed(2));
  } else {
    ret = 0.0;
  }

  let totalDescuento = 0;
  let T_excenta = 0;
  let tg = 0;
  let td = 0;
  for (let index = 0; index < _facL.length; index++) {
	totalDescuento = 0;
    const element = _facL[index];
    totalDescuento =
      totalDescuento + (element.DESC_TOT_LINEA + element.DESCUENTO_VOLUMEN);

    if (element.IMPUESTO === "4") {
      T_excenta = element.PRECIO_TOTAL + T_excenta - totalDescuento;
      td = parseFloat(totalDescuento.toFixed(2));
      tg = 0;
    } else {
      T_excenta = 0;
      tg = (_fac[0].totalGravada - T_excenta) * process.env.DTE_IMPUESTO;
      td = parseFloat((totalDescuento * process.env.DTE_IMPUESTO).toFixed(2));
    }
  }

  const _resumen = {
    totalNoSuj: 0.0,
    totalExenta: parseFloat(T_excenta.toFixed(2)),
    totalGravada: parseFloat(tg.toFixed(2)),
    //    totalGravada: 531.10,
    subTotalVentas: parseFloat(_fac[0].montoTotalOperacion.toFixed(2)),
    descuNoSuj: 0.0,
    descuExenta: 0.0,
    descuGravada: 0.0,
    porcentajeDescuento: 0.0,
    totalDescu: td,
    tributos: null,
    subTotal: parseFloat(
      (_fac[0].subTotalVentas + _fac[0].totalImpuesto).toFixed(2)
    ),
    //ivaPerci1: 0,
    ivaRete1: ret,
    reteRenta: 0,
    montoTotalOperacion: parseFloat(_fac[0].montoTotalOperacion.toFixed(2)),
    totalNoGravado: 0,
    totalPagar: parseFloat((_fac[0].totalPagar - ret).toFixed(2)),
    totalLetras:
      NumeroLetras(parseFloat((_fac[0].totalPagar - ret).toFixed(2))) + " USD",
    totalIva: parseFloat(_fac[0].totalImpuesto.toFixed(2)),
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: parseFloat((_fac[0].totalPagar - ret).toFixed(2)),
        plazo: null,
        referencia: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };
  return _resumen;
};

module.exports = { postDte01 };

