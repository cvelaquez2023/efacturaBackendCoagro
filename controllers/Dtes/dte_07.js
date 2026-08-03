//Comprobante de Retencion

const { QueryTypes } = require("sequelize");
const moment = require("moment");
const {
  identificacion,
  emisor,
  receptor,
  receptor07,
  firmaMH,
  autorizacionMh,
} = require("../../config/MH");
const { sequelize } = require("../../config/mssql");
const { Sqlempresa, SqlRetencionCp, SqlDte } = require("../../sqltx/sql");
const { NumeroLetras } = require("../../config/letrasNumeros");
const {
  guardarDte,
  guardarRespuestaMH,
  updateDte,
  guardarObservacionesMH,
  guardarIdentificacion,
  guardarEmision,
  guardarReceptor,
  guardarcueroDocumento,
  guardarResumen,
  updateFacturaDte,
} = require("../../sqltx/Sqlguardar");
const {
  emailRechazo,
  emailEnviado,
  emailContingencia,
} = require("../../utils/email");
const fs = require("fs");
const path = require("path");
const generaPdf = require("../../utils/generaPdf");
const { resolveObjectURL } = require("buffer");
const Usuarios = require("../../models/Usuarios");
const postDte07 = async (req, res) => {
  const _factura = req.params.factura;

  const _dteProcesado = await SqlDte(_factura);
  if (_dteProcesado.length > 0) {
    if (_dteProcesado[0].estado == "PROCESADO") {
      console.log("documento ya fue Porcesadp");
      return res.send({ messaje: "Documeto ya fue proceado", result: false });
    }
  }
  const _empresa = req.params.id;
  let estado = "";
  if (!_factura) {
    return res.send({
      messaje: "Es requerida Numero Factura",
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
  const empresa = await Sqlempresa(_empresa);
  const HayContingencia = empresa[0].contingencia;
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
    });
  }

  const datos = await sequelize.query(
    `EXEC dte.dbo.dte_AuxiliarCPdebito '${_factura}','RET'`,
    {
      type: QueryTypes.SELECT,
    }
  );

  const _identificacion = await identificacion("07", _empresa, _factura);
  const _emisor = await emisor(_empresa, "07");
  const _receptor = await receptor07(_factura);
  const _cuerpo = await cuerpoDoc(_factura);
  const _resumen = await resumen(_factura);
  const _extesnsion = await extension();

  const dte = {
    identificacion: _identificacion,
    emisor: _emisor,
    receptor: _receptor,
    cuerpoDocumento: _cuerpo,
    resumen: _resumen,
    extension: _extesnsion,
    apendice: null,
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
    origen: "PROVEEDOR",
    nombre: _receptor.nombre,
    procesado: 0,
    modulo: datos[0].ORIGEN,
    tipoDoc: "07",
    selloRecibido: "ND",
    codigoGeneracion: _identificacion.codigoGeneracion,
    estado: estado,
    fechaemision: _identificacion.fecEmi,
    montoTotal: _resumen.totalIVAretenido,
    Documento: _receptor.numDocumento,
    Empresa_id: _empresa,
    firma: _firma,
    usuario_Id: Usuario,
  };

  await guardarDte(dataDte);
  await guardarIdentificacion(_identificacion, _factura);
  await guardarEmision(_emisor, _factura);
  await guardarReceptor(_receptor, _factura);
  await guardarcueroDocumento(_cuerpo, _factura, "07");
  await guardarResumen(_resumen, _factura, "07");

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

    const _respuestaMH = await postrecepciondte();
    await guardarRespuestaMH(_respuestaMH, _factura);
    await updateDte(_respuestaMH, _factura);
    await updateFacturaDte(_factura);
    await guardarObservacionesMH(_respuestaMH.observaciones, _factura);
    await guardarObservacionesMH([_respuestaMH.descripcionMsg], _factura);

    const JsonCliente = {
      identificacion: _identificacion,
      emisor: _emisor,
      receptor: _receptor,
      cuerpoDocumento: _cuerpo,
      resumen: _resumen,
      extension: _extesnsion,
      apendice: null,
      respuestaMh: _respuestaMH,
    };

    if (
      _respuestaMH.estado === "RECHAZADO" &&
      _respuestaMH.codigoMsg === "004"
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
            "../../storage/json/dte07/rechazados/"
          );
          const newfile = fileName + `${_identificacion.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _identificacion.numeroControl,
            "rechazosdte@drogueriauniversal.com",
            "dte07"
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
      } else if (_respuestaMH.estado == "PROCESADO") {
        //enviasmos correo a cliente y pdf

        await generaPdf.generaPdf07(_factura);
        setTimeout(function () {
          console.log("procedemos a enviarlos");
        }, 1000);

        const fileName = path.join(
          __dirname,
          "../../storage/json/dte07/aceptados/"
        );
        const newfile = fileName + `${_identificacion.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        await emailEnviado(
          _identificacion.numeroControl,
          _receptor.correo,
          "dte07"
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
    const fileName = path.join(
      __dirname,
      "../../storage/json/dte07/contingencia/"
    );
    const newfile = fileName + `${_identificacion.numeroControl}.json`;

    fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
    await emailContingencia(
      _identificacion.numeroControl,
      "disvelper@gmail.com",
      "dte03"
    );
    await sequelize.query(
      `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}'`,
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
const cuerpoDoc = async (documento) => {
  const datos = await sequelize.query(
    `EXEC dte.dbo.dte_AuxiliarCPdebito '${documento}','RET'`,
    {
      type: QueryTypes.SELECT,
    }
  );

  if (datos[0].ORIGEN === "CP") {
    const docCp = await sequelize.query(
      `EXEC dte.dbo.dte_documentoCP '${datos[0].PROVEEDOR}','${datos[0].CREDITO}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const notRetencion = await sequelize.query(
      `EXEC dte.dbo.dte_documentoCP '${datos[0].PROVEEDOR}','${datos[0].DEBITO}'`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const _tipo = notRetencion[0].APLICACION.substring(16, 19);
    const _documento = datos[0].CREDITO;
    const _codRetencion = notRetencion[0].APLICACION.substring(10, 13);
    const _prove = notRetencion[0].PROVEEDOR;

    const retencion = await SqlRetencionCp(
      _prove,
      _tipo,
      _documento,
      _codRetencion
    );
    let cuerpo = [];
    const data = {
      numItem: 1,
      tipoDte: "03",
      tipoDoc: 1,
      numDocumento: docCp[0].DOCUMENTO,
      fechaEmision: docCp[0].FECHA_DOCUMENTO, 
      montoSujetoGrav: retencion[0].base,
      codigoRetencionMH: "22",
      ivaRetenido: retencion[0].monto,
      descripcion: notRetencion[0].APLICACION,
    };
    cuerpo.push(data);
    return cuerpo;
  }
  if (datos[0].ORIGEN === "CH") {
    let cuerpo = [];
    const data = {
      numItem: 1,
      tipoDte: "03",
      tipoDoc: 1,
      numDocumento: datos[0].DOC_SOPORTE,
      fechaEmision: datos[0].FECHA_DOCUMENTO,
      montoSujetoGrav: datos[0].BASE,
      codigoRetencionMH: "22",
      ivaRetenido: datos[0].MONTO,
      descripcion: datos[0].APLICACION,
    };
    cuerpo.push(data);
    return cuerpo;
  }
};
const resumen = async (documento) => {
  const datos = await sequelize.query(
    `EXEC dte.dbo.dte_AuxiliarCPdebito '${documento}','RET'`,
    {
      type: QueryTypes.SELECT,
    }
  );
  if (datos[0].ORIGEN === "CP") {
    const docCp = await sequelize.query(
      `EXEC dte.dbo.dte_documentoCP '${datos[0].PROVEEDOR}','${datos[0].CREDITO}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const notRetencion = await sequelize.query(
      `EXEC dte.dbo.dte_documentoCP '${datos[0].PROVEEDOR}','${datos[0].DEBITO}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const _tipo = notRetencion[0].APLICACION.substring(16, 19);
    const _documento = datos[0].CREDITO;
    const _codRetencion = notRetencion[0].APLICACION.substring(10, 13);
    const _prove = notRetencion[0].PROVEEDOR;

    const retencion = await SqlRetencionCp(
      _prove,
      _tipo,
      _documento,
      _codRetencion
    );

    const data = {
      totalSujetoRetencion: retencion[0].base,
      totalIVAretenido: retencion[0].monto,
      totalIVAretenidoLetras: NumeroLetras(retencion[0].monto),
    };
    return data;
  }
  if (datos[0].ORIGEN == "CH") {
    const data = {
      totalSujetoRetencion: datos[0].BASE,
      totalIVAretenido: datos[0].MONTO,
      totalIVAretenidoLetras: NumeroLetras(datos[0].MONTO),
    };
    return data;
  }
};
const extension = async () => {
  const data = {
    nombEntrega: null,
    docuEntrega: null,
    nombRecibe: null,
    docuRecibe: null,
    observaciones: null,
  };
  return data;
};
module.exports = postDte07;
