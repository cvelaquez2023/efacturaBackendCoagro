//Factura de Sujecto Excluido

const doc = require("pdfkit");
const {
  identificacion,
  emisor,
  receptor,
  firmaMH,
  autorizacionMh,
} = require("../../config/MH");
const {
  Sqlempresa,
  SqlDocumentoCPDte14,
  SqlProveedorCodigo,
  SqlDte,
  SqlDteIdentificacion,
  SqlDteEmisor,
  SqlDteSujetoExcluido,
  SqlDteCuerpo,
  SqlDteResumen,
} = require("../../sqltx/sql");
const { sequelize } = require("../../config/mssql");
const { QueryTypes } = require("sequelize");
const { NumeroLetras } = require("../../config/letrasNumeros");
const {
  guardarDte,
  guardarIdentificacion,
  guardarEmision,
  guardarSubjectoExcluido,
  guardarcueroDocumento,
  guardarResumen,
  guardarRespuestaMH,
  updateDte,
  guardarObservacionesMH,
} = require("../../sqltx/Sqlguardar");
const { emailRechazo, emailEnviado } = require("../../utils/email");
const fs = require("fs");
const moment = require("moment");
const path = require("path");
const { generaPdf14 } = require("../../utils/generaPdf");
const { json } = require("body-parser");

const postDte14 = async (req, res) => {
  const _factura = req.params.factura;
  const _empresa = req.params.id;
  const _form = req.body;

  const empresa = await Sqlempresa(_empresa);

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

  if (_form.hacienda == "N") {
    try {
      const _identificacion = await identificacion("14", _empresa, _form);

      const _emisior = await emisor(_empresa, "14");
      const _subjectoExcluido = await subjectoexculido(_form, "14");
      const _cuerpo = await cuerpoDoc(_form);
      const _resumen = await resumen(_form);

      const dte = {
        identificacion: _identificacion,
        emisor: _emisior,
        sujetoExcluido: _subjectoExcluido,
        cuerpoDocumento: _cuerpo,
        resumen: _resumen,
        apendice: null,
      };

      const datafirma = {
        nit: process.env.DTE_NIT,
        activo: true,
        passwordPri: process.env.DTE_PWD_PRIVADA,
        dteJson: dte,
      };
      const _firma = await firmaMH(datafirma);
      if (_firma == "ERROR") {
        //Se envia corre
        return res.send({
          messaje: "Es Servidor de Firma no responde",
          result: false,
        });
      }
      const dataDte = {
        dte: _form.aplicacion.dte,
        origen: "PROVEEDOR",
        nombre: _subjectoExcluido.nombre,
        procesado: 0,
        modulo: _form.origen,
        tipoDoc: "14",
        selloRecibido: "ND",
        codigoGeneracion: _identificacion.codigoGeneracion,
        estado: "PENDIENTE",
        fechaemision: _identificacion.fecEmi,
        montoTotal: _resumen.totalCompra,
        Documento: _subjectoExcluido.numDocumento,
        Empresa_id: _empresa,
        firma: _firma,
        usuario_Id: Usuario,
      };

      await guardarDte(dataDte);
      await guardarIdentificacion(_identificacion, _form.aplicacion.dte);
      await guardarEmision(_emisior, _form.aplicacion.dte);
      await guardarSubjectoExcluido(_subjectoExcluido, _form.aplicacion.dte);
      await guardarcueroDocumento(_cuerpo, _form.aplicacion.dte);
      await guardarResumen(_resumen, _form.aplicacion.dte);

      await generaPdf14(_form.aplicacion.dte);
      res.send({ response: "se guardar sin problemas", success: true });
      return;
    } catch (error) {
      console.log(error);
    }
  } else {
    //await generaPdf14(_form.aplicacion.dte);
    // res.send({ response: "se guardar sin problemas", success: true });
    // return;

    //enviamos a hacienda

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
    //consultamos dteID
    const dte = await SqlDte(_form.aplicacion.dte);

    //armmosno de json

    //consultamos _identficiacion
    const _ident = await SqlDteIdentificacion(dte[0].Dte_id);
    //consultamos _emision

    const _identificacion = await SqlDteIdentificacion(dte[0].Dte_id);
    const _ide = {
      version: _identificacion[0].version,
      ambiente: _identificacion[0].ambiente,
      tipoDte: _identificacion[0].tipoDte,
      numeroControl: _identificacion[0].numeroControl,
      codigoGeneracion: _identificacion[0].codigoGeneracion,
      tipoModelo: _identificacion[0].tipoModelo,
      tipoOperacion: _identificacion[0].tipoOperacion,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: _identificacion[0].fecEmi,
      horEmi: moment.utc(_identificacion[0].horEmi).format("HH:mm:ss"),
      tipoMoneda: _identificacion[0].tipoMoneda,
    };
    const _emisor = await SqlDteEmisor(dte[0].Dte_id);
    const _emi = {
      nit: _emisor[0].nit,
      nrc: _emisor[0].nrc,
      nombre: _emisor[0].nombre,
      codActividad: _emisor[0].codActividad,
      descActividad: _emisor[0].descActividad,
      direccion: {
        departamento: _emisor[0].direccion_depa,
        municipio: _emisor[0].direccion_muni,
        complemento: _emisor[0].direccion_compl,
      },
      telefono: _emisor[0].telefono,
      codEstableMH: _emisor[0].codEstableMH,
      codEstable: _emisor[0].codEstable,
      codPuntoVentaMH: _emisor[0].codPuntoVentaMH,
      codPuntoVenta: _emisor[0].codPuntoVenta,
      correo: _emisor[0].correo,
    };

    const _subjectoE = await SqlDteSujetoExcluido(dte[0].Dte_id);
    const _subj = {
      tipoDocumento: _subjectoE[0].tipoDocumento,
      numDocumento: _subjectoE[0].nit,
      nombre: _subjectoE[0].nombre,
      codActividad: null,
      descActividad: null,
      direccion: {
        departamento: _subjectoE[0].direccion_depa,
        municipio: _subjectoE[0].direccion_muni,
        complemento: _subjectoE[0].direccion_compl,
      },
      telefono: _subjectoE[0].telefono,
      correo: _subjectoE[0].correo,
    };

    const _cuerpo = await SqlDteCuerpo(dte[0].Dte_id);
    const _cuer = {
      numItem: _cuerpo[0].numItem,
      tipoItem: _cuerpo[0].tipoItem,
      cantidad: _cuerpo[0].cantidad,
      codigo: _cuerpo[0].codigo,
      uniMedida: _cuerpo[0].uniMedida,
      descripcion: _cuerpo[0].descripcion,
      precioUni: _cuerpo[0].precioUni,
      montoDescu: _cuerpo[0].montoDescu,
      compra: _cuerpo[0].compra,
    };

    const _resu = await SqlDteResumen(dte[0].Dte_id);
    const _resumen = {
      totalCompra: _resu[0].totalCompra,
      descu: 0,
      totalDescu: _resu[0].totalDescu,
      subTotal: _resu[0].subTotal,
      ivaRete1: _resu[0].ivaRete1,
      reteRenta: _resu[0].reteRenta,
      totalPagar: _resu[0].totalPagar,
      totalLetras: _resu[0].totalLetras,
      condicionOperacion: _resu[0].condicionOperacion,
      pagos: [
        {
          codigo: "01",
          montoPago: _resu[0].totalPagar,
          plazo: null,
          referencia: null,
          periodo: null,
        },
      ],
      observaciones: null,
    };

    //armamos el archivo veamos
    const datos = {
      identificacion: _ide,
      emisor: _emi,
      sujetoExcluido: _subj,
      cuerpoDocumento: _cuer,
      resumen: _resumen,
      apendice: null,
    };

    //Creo la firma

    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", _token);

    var raw = JSON.stringify({
      ambiente: process.env.DTE_AMBIENTE,
      idEnvio: 1,
      version: _ident[0].version,
      tipoDte: _ident[0].tipoDte,
      documento: dte[0].firma,
      codigoGeneracion: _ident[0].codigoGeneracion,
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
      if (_dteProcesado[0].estado == "PROCESADO") {
        console.log("documento ya fue Porcesadp");
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }
    const _respuestaMH = await postrecepciondte();
    await guardarRespuestaMH(_respuestaMH, _form.aplicacion.dte);
    await updateDte(_respuestaMH, _form.aplicacion.dte);
    await guardarObservacionesMH(
      _respuestaMH.observaciones,
      _form.aplicacion.dte
    );

    const JsonCliente = {
      identificacion: _ide,
      emisor: _emi,
      subjectoExcluido: _subj,
      cuerpoDocumento: _cuer,
      resumen: _resumen,
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
            "../../storage/json/dte14/rechazados/"
          );
          const newfile = fileName + `${_ide.numeroControl}.json`;

          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _ide.numeroControl,
            process.env.DTE_CORREO,
            "dte14"
          );

          res.send({
            success: false,
            result: "Procesado en Hacienda Rechazado",
            hacienda: false,
          });
          return;
        } catch (error) {
          console.log(error);
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado == "PROCESADO") {
        //enviasmos correo a cliente y pdf
        await generaPdf14(_form.aplicacion.dte);
        //await fac03(_factura);
        //await fac01(_factura);

        const fileName = path.join(
          __dirname,
          "../../storage/json/dte14/aceptados/"
        );
        const newfile = fileName + `${_ide.numeroControl}.json`;

        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        await emailEnviado(
          _ide.numeroControl,
          _subj.correo,
          "factura@coagro.com",
	 _subj.nombre,
          "dte14"
        );
        //guardamos en CP
        if (_form.origen === "CP") {
          const _documetoCp = await sequelize.query(
            `EXEC dte.dbo.dte_DocumentosCPSujetoExcludio ${dte[0].Dte_id},'FAC','${_ide.fecEmi}','${_ide.fecEmi}','${_cuer.descripcion}','30',15,'${_ide.fecEmi}','4','${_respuestaMH.selloRecibido}' `,
            {
              type: sequelize.QueryTypes.SELECT,
            }
          );
        }

        res.send({
          messaje: "Procesado en Hacienda Aceptados",
          result: _respuestaMH.selloRecibido,
          success: true,
          hacienda: true,
        });
        return;
      }
    }
  }
};
const subjectoexculido = async (_factura) => {
  let tipo = "";
  if (_factura.numDocumento.length > 9) {
    tipo = "36";
  } else {
    tipo = "13";
  }

  const data = {
    tipoDocumento: tipo,
    numDocumento: _factura.numDocumento.replaceAll("-", ""),
    nombre: _factura.nombre,
    codActividad: null,
    descActividad: null,
    direccion: {
      departamento: _factura.direccion.departamento,
      municipio: _factura.direccion.municipio,
      complemento: _factura.direccion.complemento,
    },
    telefono: _factura.telefono,
    correo: _factura.correo,
  };
  return data;
};
const cuerpoDoc = async (_factura) => {
  const _cuerpoDoc = [];
  const data = {
    numItem: 1,
    tipoItem: 2,
    cantidad: 1,
    codigo: null,
    uniMedida: 59,
    descripcion: _factura.aplicacion.descripcion.toUpperCase(),
    precioUni: parseFloat(_factura.aplicacion.monto.toFixed(2)),
    montoDescu: 0,
    compra: parseFloat(_factura.aplicacion.monto.toFixed(2)),
  };
  _cuerpoDoc.push(data);
  return _cuerpoDoc;
};
const resumen = async (_factura) => {
  const datos = {
    totalCompra: parseFloat(_factura.aplicacion.monto.toFixed(2)),
    descu: 0.0,
    totalDescu: 0.0,
    subTotal: parseFloat(_factura.aplicacion.monto.toFixed(2)),
    ivaRete1: 0.0,
    reteRenta: parseFloat(_factura.aplicacion.renta.toFixed(2)),
    totalPagar: parseFloat(_factura.aplicacion.total.toFixed(2)),
    totalLetras:
      NumeroLetras(parseFloat(_factura.aplicacion.total.toFixed(2))) + " USD",
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: parseFloat(_factura.aplicacion.total.toFixed(2)),
        plazo: null,
        referencia: null,
        periodo: null,
      },
    ],
    observaciones: null,
  };

  return datos;
};

module.exports = { postDte14 };
