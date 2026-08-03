const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { subtipoDocCCModel, documentoModel } = require("../../models");
const { NumeroLetras } = require("../../config/letrasNumeros");
const { desencrypt } = require("../../utils/handlePassword");

const fs = require("fs");
const path = require("path");
const {
  receptor,
  identificacion,
  emisor,
  firmaMH,
  autorizacionMh,
  apendice,
} = require("../../config/MH");
const {
  SqlFactura,
  SqlFacturaLinea,
  Sqlempresa,
  SqlDocumentoCC,
  SqlVendedorCodigo,
  SqlDte,
} = require("../../sqltx/sql");
const {
  guardarDte,
  guardarIdentificacion,
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
const generaPdf = require("../../utils/generaPdf");
const { resourceLimits } = require("worker_threads");
//Credito Fiscal
const postDte03 = async (req, res) => {
  const _factura = req.params.factura;
  const _empresa = req.params.id;
  let estado = "";
  if (!_factura) {
    return res.send({ messaje: "Es requerida Numero Factura", result: false });
  }


  const _docExit = await SqlDocumentoCC(_factura);

  if (_docExit.length === 0) {
   console.log("Documento no esta en Cuentas por Cobrar",_factura);
    return res.send({ messaje: "Documento no existe", result: false });
  }

  const empresa = await Sqlempresa(_empresa);
  const HayContingencia = empresa[0].contingencia;
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
    });
  }
  const User = req.cliente;
  let Usuario;
  if (User === undefined) {
    Usuario = 1;
  } else {
    Usuario = User[0].usuario_id;
  }

  const _identificacion = await identificacion("03", _empresa, _factura);
  const _emisor = await emisor(_empresa, "03");
  const _receptor = await receptor(_factura, "03");
  const _cuerpo = await cuerpoDoc(_factura, _docExit[0].SUBTIPO);
  const _cuerpoLote = await cuerpoDocLote(_factura, _docExit[0].SUBTIPO);
  const _resumen = await resumen(_factura);
  const _extension = null;
  const _apendice = await apendice(_factura, _docExit[0].SUBTIPO_DOC_CXC, "03");

  const _fechaFac = await SqlFactura(_factura);
  const _vendedor = await SqlVendedorCodigo(_fechaFac[0].VENDEDOR);
  let _correoVendedor;
  if (_vendedor[0].e_mail != null) {
    _correoVendedor = _vendedor[0].e_mail;
  } else {
    _correoVendedor = "factura@coagro.com";
  }

  const dte = {
    identificacion: _identificacion,
    documentoRelacionado: null,
    emisor: _emisor,
    receptor: _receptor,
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: _cuerpo,
    resumen: _resumen,
    extension: _extension,
    apendice: _apendice,
  };

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

  //Realizamos Firma
  const _firma = await firmaMH(datafirma);
  

  if (_firma === "ERROR") {
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
    tipoDoc: "03",
    selloRecibido: "ND",
    codigoGeneracion: _identificacion.codigoGeneracion,
    estado: estado,
    fechaemision: _fechaFac[0].FECHAFULL,
    montoTotal: _resumen.totalGravada,
    Documento: _receptor.nit,
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
  await guardarApendice(_factura);

  if (!HayContingencia) {
    //Atutenticamos
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
    const _dteProcesado = await SqlDte(_factura);
    if (_dteProcesado.length > 0) {
      if (_dteProcesado[0].estado === "PROCESADO") {
          await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
          {
            type: QueryTypes.SELECT,
          }
        );
        console.log("documento ya fue Porcesadp",_factura);
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }

    const _respuestaMH = await postrecepciondte();
    console.log(_respuestaMH);
    if (_respuestaMH.codigoMsg === "097") {
      console.log("reenviaremos de nuevo");
      return;
    }

    await guardarRespuestaMH(_respuestaMH, _factura);

    await updateDte(_respuestaMH, _factura);
    await updateFacturaDte(_factura);

    if (_respuestaMH.observaciones != null) {
      await guardarObservacionesMH(_respuestaMH.observaciones, _factura);
    }

    await guardarObservacionesMH([_respuestaMH.descripcionMsg], _factura);
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
      respuestaMh: _respuestaMH,
      firma: _firma,
    };

     if (_respuestaMH.codigoMsg === "004") {
      return;
    }
    if (
      _respuestaMH.estado === "XXX" 
    ) {
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

          const fileName = path.join(
            __dirname,
            "../../storage/json/dte03/rechazados/"
          );
          const newfile = fileName + `${_identificacion.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _identificacion.numeroControl,
            "factura@coagro.com",
            "dte03"
          );

          await sequelize.query(
            `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
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
          console.log(error);
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado === "PROCESADO") {
        //enviasmos correo a cliente y pdf

        //await fac01(_factura);

        await generaPdf.generaPdf(_factura);
        setTimeout(function () {
          console.log("procedemos a enviarlos");
        }, 1000);

        const fileName = path.join(
          __dirname,
          "../../storage/json/dte03/aceptados/"
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        await emailEnviado(
          _identificacion.numeroControl,
          _receptor.correo,
          _correoVendedor,
	  _receptor.nombre,
          "dte03"
        );
        await sequelize.query(
          `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
          {
            type: QueryTypes.SELECT,
          }
        );
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
      "../../storage/json/dte03/contingencia/"
    );
    const newfile = fileName + `${_identificacion.numeroControl}.json`;

    fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
    await emailContingencia(
      _identificacion.numeroControl,
      "factura@coagro.com",
      "dte03"
    );
    await sequelize.query(
      `EXEC dte.dbo.dte_ActualizarFacturaDte'${_factura}'`,
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
};
const cuerpoDoc = async (_documento, tipo) => {
  if (tipo == 41) {
    const dataFacLinea = await sequelize.query(
      `EXEC dte.dbo.dte_FacturaLineaKit '${_documento}'`,
      { type: QueryTypes.SELECT }
    );
    const _cuerpoDoc = [];
    let totalLinea = 0;
    let totalDescuento = 0;
    let totalImpuesto1 = 0;
    let ventatotalGravada = 0;

    for (let index = 0; index < dataFacLinea.length; index++) {
      const element = dataFacLinea[index];
      const _tipo = element.TIPO;

      if (_tipo === "K") {
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
          descripcion: element.DESCRIPCION,
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
    }

    const _totalPagar = totalLinea - totalDescuento + totalImpuesto1;
    return _cuerpoDoc;
  } else {
    try {
      const dataFacLinea = await sequelize.query(
        `EXEC dte.dbo.dte_FacturaLinea '${_documento}'`,
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
        const decLinea = element.DESC_TOT_LINEA + element.DESC_TOT_GENERAL;
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
    } catch (error) {
      console.log(error);
    }
  }
};
const cuerpoDocLote = async (_documento, tipo) => {
  if (tipo == 41) {
    try {
      const dataFacLinea = await sequelize.query(
        `EXEC dte.dbo.dte_FacturaLineaKit '${_documento}'`,
        { type: QueryTypes.SELECT }
      );
      const _cuerpoDoc = [];
      let totalLinea = 0;
      let totalDescuento = 0;
      let totalImpuesto1 = 0;
      let ventatotalGravada = 0;

      for (let index = 0; index < dataFacLinea.length; index++) {
        const element = dataFacLinea[index];
        const _tipo = element.TIPO;

        if (_tipo === "K") {
          const precio = element.PRECIO_UNITARIO;
          const decLinea = element.DESC_TOT_LINEA + element.DESC_TOT_GENERAL;
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
            descripcion: element.DESCRIPCION,
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
      }

      const _totalPagar = totalLinea - totalDescuento + totalImpuesto1;
      return _cuerpoDoc;
    } catch (error) {
      console.log(error);
    }
  } else {
    try {
      const dataFacLinea = await sequelize.query(
        `EXEC dte.dbo.dte_FacturaLinea '${_documento}'`,
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
        const decLinea = element.DESC_TOT_LINEA + element.DESC_TOT_GENERAL;
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
    } catch (error) {
      console.log(error);
    }
  }
  const dataFacLinea = await sequelize.query(
    `EXEC dte.dbo.dte_FacturaLinea '${_documento}'`,
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
};
const resumen = async (_documento) => {
  const _fac = await SqlFactura(_documento);
  const _facL = await SqlFacturaLinea(_documento);
  const _docc = await SqlDocumentoCC(_documento);

  let totalDescuento = 0;
  for (let index = 0; index < _facL.length; index++) {
    const element = _facL[index];
    totalDescuento =
      totalDescuento +
      (element.DESC_TOT_LINEA +
        element.DESCUENTO_VOLUMEN +
        element.DESC_TOT_GENERAL);
  }
  const _resumen = {
    totalNoSuj: 0.0,
    totalExenta: 0.0,
    totalGravada: parseFloat(_fac[0].totalGravada.toFixed(2)),
    subTotalVentas: parseFloat(_fac[0].subTotalVentas.toFixed(2)),
    descuNoSuj: 0.0,
    descuExenta: 0.0,
    descuGravada: 0.0,
    porcentajeDescuento: 0.0,
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
    ivaRete1: parseFloat(_docc[0].monto_retencion.toFixed(2)),
    reteRenta: 0,
    montoTotalOperacion: parseFloat(_fac[0].montoTotalOperacion.toFixed(2)),
    totalNoGravado: 0,
    totalPagar: parseFloat(
      (_fac[0].totalPagar - _docc[0].monto_retencion).toFixed(2)
    ),
    totalLetras:
      NumeroLetras(
        parseFloat((_fac[0].totalPagar - _docc[0].monto_retencion).toFixed(2))
      ) + " USD",
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: parseFloat(
          (_fac[0].totalPagar - _docc[0].monto_retencion).toFixed(2)
        ),
        plazo: null,
        referencia: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };

  return _resumen;
};

module.exports = { postDte03 };
