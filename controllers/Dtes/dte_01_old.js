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
const { error } = require("console");
const { fac01, fac03 } = require("../../storage/pdf/dte01/factura");
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

//Factura
const postDte01 = async (req, res) => {
  const _factura = req.params.factura;
  const _empresa = req.params.id;
  let estado = "";
  if (!_factura) {
    return res.send({
      messaje: "Es requerida Numero Factura",
      result: false,
    });
  }

  const _docExit = await Sql.SqlFactura(_factura);
  if (_docExit.length === 0) {
    return res.send({ messaje: "Documento no existe", result: false });
  }

  const User = req.cliente;
  let Usuario;
  if (User === undefined) {
    Usuario = 1;
  } else {
    Usuario = User[0].usuario_id;
  }

  const empresa = await Sql.Sqlempresa(_empresa);
  const HayContingencia = empresa[0].Contingencia;
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
    });
  }

  const _identificacion = await identificacion("01", _empresa, _factura);

  const _documentoRelacionado = null;
  const _emisor = await emisor(_empresa, "01");
  const _receptor = await receptor(_factura, "01");
  const _otrosDocumentos = null;
  const _ventaTercero = null;

  //const _cuerpo = await cuerpoDocLic(_factura,_docExit[0].observaciones, _docExit[0].SUBTIPO_DOC_CXC);

  const _cuerpo = await cuerpoDoc(
    _factura,
    _docExit[0].observaciones,
    _docExit[0].SUBTIPO_DOC_CXC
  );

  const _cuerpoLote = await cuerpoDoclote(
    _factura,
    _docExit[0].observaciones,
    _docExit[0].SUBTIPO_DOC_CXC
  );

  const _resumen = await resumen(_factura);

  const _extension = null;
  const _apendice = await apendice(_factura, _docExit[0].SUBTIPO_DOC_CXC, "01");

  const _fechaFac = await Sql.SqlFactura(_factura);
  const _vendedor = await Sql.SqlVendedorCodigo(_fechaFac[0].VENDEDOR);
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

  const datafirma = {
    nit: process.env.DTE_NIT,
    activo: true,
    passwordPri: process.env.DTE_PWD_PRIVADA,
    dteJson: dte,
  };
  if (HayContingencia) {
    estado = "CONTINGENCIA";
  } else {
    estado = "PENDIENTE";
  }

  const _firma = await firmaMH(datafirma);
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

  await guardarDte(dataDte);
  await guardarIdentificacion(_identificacion, _factura);
  await guardarEmision(_emisor, _factura);
  await guardarReceptor(_receptor, _factura);
  await guardarcueroDocumento(_cuerpoLote, _factura);
  await guardarResumen(_resumen, _factura);
  await guardarTributoResumen(_resumen.tributos, _factura);
  await guardarPagoResumen(_resumen.pagos, _factura);
  await guardarApendice(_factura, _docExit[0].SUBTIPO_DOC_CXC, "01");

  if (!HayContingencia) {
    const _auth = await autorizacionMh();
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
      ambiente: process.env.DTE_AMBIENTE,
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
        const response = await fetch(
          "https://api.dtes.mh.gob.sv/fesv/recepciondte",
          requestOptions
        );
        const data = await response.json();
        return data;
      } catch (error) {
        console.log("error", error);
      }
    };

    const _dteProcesado = await Sql.SqlDte(_factura);
    if (_dteProcesado.length > 0) {

      if (_dteProcesado[0].estado == "PROCESADO") {
        await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
          {
            type: QueryTypes.SELECT,
          }
        );
        console.log("documento ya fue Porcesadp", _factura);
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }
    const _respuestaMH = await postrecepciondte();
    await guardarRespuestaMH(_respuestaMH, _factura);
    await updateDte(_respuestaMH, _factura);
    await updateFacturaDte(_factura);
    await guardarObservacionesMH(_respuestaMH.observaciones, _factura);
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
//console.log(_respuestaMH);
 if (_respuestaMH.codigoMsg === "004") {
      return;
    }

    if (_respuestaMH.estado === "RECHAZADO" ) {
     
      await sequelize.query(
        `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
        {
          type: QueryTypes.SELECT,
        }
      );
      return;
    } else {
      if (_respuestaMH.estado === "RECHAZADO") {
        try {
          //  await fac01(_factura);
//   console.log(_respuestaMH)
          const fileName = path.join(
            __dirname,
            "../../storage/json/dte01/rechazados/"
          );
          const newfile = fileName + `${_identificacion.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _identificacion.numeroControl,
            "factura@coagro.com",
            //"rechazosdte@drogueriauniversal.com",
            "dte01"
          );

          await sequelize.query(
            `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
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
          console.log(error);
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado === "PROCESADO") {
        //enviasmos correo a cliente y pdf

        await generaPdf.generaPdf(_factura);
        setTimeout(function () {
          console.log("procedemos a enviarlos");
        }, 1000);

        //await fac03(_factura);
        //await fac01(_factura);
        const fileName = path.join(
          __dirname,
          "../../storage/json/dte01/aceptados/"
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        let _correo = "";
        if (_receptor.correo == undefined || _receptor.correo == null) {
          _correo = "factura@coagro.com";
        } else {
          _correo = _receptor.correo;
        }
        await emailEnviado(
          _identificacion.numeroControl,
          _correo,
          _correoVendedor,
          _receptor.nombre,
          "dte01"
        );
        await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
          {
            type: QueryTypes.SELECT,
          }
        );
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
      "../../storage/json/dte01/contingencia/"
    );
    const newfile = fileName + `${_identificacion.numeroControl}.json`;

    fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
    await emailEnviado(
      _identificacion.numeroControl,
      _receptor.correo,
      "dte01"
    );

    res.send({
      messaje: "Procesado en Contingencia",
      result: true,
      hacienda: false,
    });
  }
};
const cuerpoDoc = async (_factura, obser, tipo) => {

  if (tipo == 110) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLineaLicitaciones '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea51 '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea '${_factura}'`,
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

const cuerpoDoclote = async (_factura, obser, tipo) => {
  if (tipo === 47) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLineaLicitaciones '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea51 '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea '${_factura}'`,
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
      `EXEC dte.dbo.dte_FacturaLinea '${_factura}'`,
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
const resumen = async (_documento) => {
  const _fac = await Sql.SqlFactura(_documento);
  const _facL = await Sql.SqlFacturaLinea(_documento);
  const _ret = await Sql.SqlFacturaRet(_documento);

  let ret = 0;
  if (_ret.length > 0) {
    ret = parseFloat(_ret[0].MONTO.toFixed(2));
  } else {
    ret = 0.0;
  }

  let totalDescuento = 0;
  let T_excenta = 0;
  for (let index = 0; index < _facL.length; index++) {
    const element = _facL[index];
    totalDescuento =
      totalDescuento + (element.DESC_TOT_LINEA + element.DESCUENTO_VOLUMEN);

    if (_fac[0].SUBTIPO_DOC_CXC === 10) {
      T_excenta = element.PRECIO_TOTAL+T_excenta;
    } else {
      T_excenta = 0;
    }
  }
  const tg = (_fac[0].totalGravada - T_excenta) * process.env.DTE_IMPUESTO;
  const _resumen = {
    totalNoSuj: 0.0,
    totalExenta: parseFloat(T_excenta.toFixed(2)),
    totalGravada: parseFloat(tg.toFixed(2)),
    subTotalVentas: parseFloat(_fac[0].montoTotalOperacion.toFixed(2)),
    descuNoSuj: 0.0,
    descuExenta: 0.0,
    descuGravada: 0.0,
    porcentajeDescuento: 0.0,
    totalDescu: parseFloat(
      (totalDescuento * process.env.DTE_IMPUESTO).toFixed(2)
    ),
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
