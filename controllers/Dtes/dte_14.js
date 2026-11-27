//Factura de Sujecto Excluido

const doc = require("pdfkit");
const {
  identificacion,
  emisor,
  receptor,
  firmaMH,
  autorizacionMh,
  esV2,
  VERSION_V2,
} = require("../../config/MH");
const { aV2 } = require("../../utils/dteV2");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");
const {
  Sqlempresa,
  SqlDocumentoCPDte14,
  SqlProveedorCodigo,
  SqlProveedor,
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
 try {
  const _factura = req.params.factura;
  const _form = req.body;
  const _ano = process.env.ANO
  const User = req.cliente;

  const empresa = await Sqlempresa(User[0].empresa);
  // Se revisa antes de leer empresa[0] (antes fallaba con "Cannot read properties of undefined")
  if (empresa.length === 0) {
    return res.send({
      messaje: "Empresa No existe o no esta activa",
      result: false,
      success: false,
    });
  }
  const _empresa = empresa[0].Empresa_id;

 
  let Usuario;
  if (User === undefined) {
    Usuario = 1;
  } else {
    Usuario = User[0].usuario_id;
  }

  if (_form.hacienda == "N") {
    try {
      const _identificacion = await identificacion("14", _empresa, _form);
      const _emisior = await emisor(empresa, "14");
      const _v2 = esV2(empresa, "14");
      const _subjectoExcluido = await subjectoexculido(_form, _v2);
      // FSE v2 exige departamento, municipio, distrito y complemento: sin ellos Hacienda
      // rechaza. Se avisa antes de firmar y guardar (el correlativo no se consume).
      if (_v2) {
        const faltan = faltantesDireccionV2(_subjectoExcluido.direccion);
        if (faltan.length) {
          return res.send({
            messaje: `El proveedor no tiene ${faltan.join(", ")} para DTE v2. Corríjalo en el ERP y vuelva a intentar.`,
            result: false,
            success: false,
          });
        }
      }
      const _cuerpo = await cuerpoDoc(_form);
      const _resumen = await resumen(_form);
      const dteV1 = {
        identificacion: _identificacion,
        emisor: _emisior,
        sujetoExcluido: _subjectoExcluido,
        cuerpoDocumento: [_cuerpo],
        resumen: _resumen,
        apendice: null,
      };
      // DTE v2.0 (FSE v2): sujetoExcluido -> receptor, sin ivaRete
      const dte = _v2 ? aV2(dteV1, "14") : dteV1;

      const datafirma = {
        nit: empresa[0].nit,
        activo: true,
        passwordPri: empresa[0].pwdPrivado,
        dteJson: dte,
      };
      const _firma = await firmaMH(datafirma, empresa);
      if (_firma == "ERROR") {
        //Se envia corre
        return res.send({
          messaje: "Es Servidor de Firma no responde",
          result: false,
          success: false,
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

      await guardarDte(dataDte, _empresa);
      await guardarIdentificacion(_identificacion, _form.aplicacion.dte, _empresa);
      await guardarEmision(_emisior, _form.aplicacion.dte, _empresa);
      await guardarSubjectoExcluido(_subjectoExcluido, _form.aplicacion.dte, _empresa);
      await guardarcueroDocumento(_cuerpo, _form.aplicacion.dte,"14", _empresa);
      await guardarResumen(_resumen, _form.aplicacion.dte, _empresa);
     
      await generaPdf14(_form.aplicacion.dte,_ano, _empresa);
      res.send({ response: "se guardar sin problemas", success: true });
      return;
    } catch (error) {
      logger.error(`Error al crear DTE 14: ${error.message}`, { controller: "dte_14", action: "postDte14" });
      // Antes no se respondía y el formulario quedaba esperando
      return res.send({
        messaje: "No se pudo guardar el documento de Sujeto Excluido",
        result: false,
        success: false,
        error: error.message,
      });
    }
  } else {
    //await generaPdf14(_form.aplicacion.dte);
    // res.send({ response: "se guardar sin problemas", success: true });
    // return;

    //enviamos a hacienda

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

    //consultamos dteID
    const dte = await SqlDte(_form.aplicacion.dte,_empresa);
 
    //armmosno de json



    


    //consultamos _identficiacion
    const _ident = await SqlDteIdentificacion(dte[0].Dte_id,_empresa);
    //consultamos _emision

    const _identificacion = await SqlDteIdentificacion(dte[0].Dte_id,_empresa);
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

    const _subjectoE = await SqlDteSujetoExcluido(dte[0].Dte_id,_empresa);
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

    // DTE v2.0: se decide por la configuración actual de la empresa, así un
    // documento guardado en v1 se reenvía como v2 después del cambio.
    const _v2 = esV2(empresa, "14");
    if (_v2) {
      _ide.version = VERSION_V2["14"];

      // Emisor: si el documento se guardó antes de v2 (sin distrito), se usa la
      // dirección actual de la empresa, que ya está en códigos MH v2.
      if (_emisor[0].direccion_dist) {
        _emi.direccion.distrito = _emisor[0].direccion_dist;
      } else {
        _emi.direccion = {
          departamento: empresa[0].departamento,
          municipio: empresa[0].municipio,
          distrito: empresa[0].distrito,
          complemento: empresa[0].complementoDir,
        };
      }

      // Sujeto excluido: guardado en v2 ya trae los códigos MH; si se guardó en v1
      // (sin distrito), se toma la dirección MH actual del proveedor en el ERP.
      if (_subjectoE[0].direccion_dist) {
        _subj.direccion.distrito = _subjectoE[0].direccion_dist;
      } else {
        const _prov = await SqlProveedor(_subjectoE[0].nit, empresa[0].esquemaBD);
        if (_prov.length > 0) {
          _subj.direccion = direccionProveedorMh(_prov[0], _subj.direccion.complemento);
        }
      }

      const faltanEmisor = faltantesDireccionV2(_emi.direccion);
      const faltanSujeto = faltantesDireccionV2(_subj.direccion);
      if (faltanEmisor.length || faltanSujeto.length) {
        return res.send({
          messaje: faltanSujeto.length
            ? `El proveedor no tiene ${faltanSujeto.join(", ")} para DTE v2. Corríjalo en el ERP y vuelva a enviar.`
            : `La empresa no tiene ${faltanEmisor.join(", ")} para DTE v2 (DTE.dbo.empresa).`,
          result: false,
          success: false,
        });
      }
    }
    // v2 acepta null pero no textos vacíos o cortos
    _subj.telefono = textoMh(_subj.telefono, 8, 30);
    _subj.correo = correoMh(_subj.correo);

    //armamos el archivo veamos
    const datosV1 = {
      identificacion: _ide,
      emisor: _emi,
      sujetoExcluido: _subj,
      cuerpoDocumento: [_cuer],
      resumen: _resumen,
      apendice: null,
    };
    const datos = _v2 ? aV2(datosV1, "14") : datosV1;
  logger.debug("Debug datos", { controller: "dte_14", action: "postDte14" });
    //Creo la firma

  const datafirma = {
        nit: empresa[0].nit,
        activo: true,
        passwordPri: empresa[0].pwdPrivado,
        dteJson: datos,
      };
      const _firma = await firmaMH(datafirma, empresa);
    // Antes no se revisaba: con DTE_VALIDAR=bloquear se enviaba "ERROR" como documento
    if (_firma == "ERROR") {
      return res.send({
        messaje: "Es Servidor de Firma no responde o el documento no cumple el esquema MH",
        result: false,
        success: false,
      });
    }
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", _token);

    // El ambiente del envío es el del documento (antes se tomaba del .env)
    const _ambienteEnvio = _ide.ambiente || process.env.DTE_AMBIENTE;
    var raw = JSON.stringify({
      ambiente: _ambienteEnvio,
      idEnvio: 1,
      version: _ide.version,
      tipoDte: _ident[0].tipoDte,
      documento: _firma,
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
        // Antes iba siempre a producción, aun con ambiente de pruebas ("00")
        const url =
          _ambienteEnvio === "00"
            ? "https://apitest.dtes.mh.gob.sv/fesv/recepciondte"
            : "https://api.dtes.mh.gob.sv/fesv/recepciondte";
        const response = await fetch(url, requestOptions);
        const data = await response.json();
         logger.debug("Respuesta MH data", { controller: "dte_14", action: "postDte14" })
        return data;
      } catch (error) {
        logger.error("Error interno", { controller: "dte_14", action: "postDte14" });
      }
    };
    const _dteProcesado = await SqlDte(_form.aplicacion.dte,_empresa);
  
    if (_dteProcesado.length > 0) {
      if (_dteProcesado[0].estado == "PROCESADO") {
        logger.info("Documento ya fue procesado", { controller: "dte_14", action: "postDte14" });
        return res.send({ messaje: "Documeto ya fue proceado", result: false });
      }
    }
    const _respuestaMH = await postrecepciondte();
    if (!_respuestaMH) {
      return res.send({
        messaje: "Hacienda no respondió. Intente enviar de nuevo.",
        result: false,
        success: false,
      });
    }
    await guardarRespuestaMH(_respuestaMH, _form.aplicacion.dte,_empresa);
    await updateDte(_respuestaMH, _form.aplicacion.dte,_empresa);
    await guardarObservacionesMH(
      _respuestaMH.observaciones,
      _form.aplicacion.dte,
	_empresa
    );

    // El JSON entregado es el mismo que se firmó
    const JsonCliente = {
      ...datos,
      respuestaMh: _respuestaMH,
    };
    if (
      _respuestaMH.estado === "RECHAZADO" &&
      _respuestaMH.codigoMsg === "004"
    ) {
      await sequelize.query(
        `EXEC dte.dbo.dte_ActualizarFacturaRico '${_factura}',${_empresa}`,
        {
          type: QueryTypes.SELECT,
        }
      );
      // Antes se hacía return sin responder y el frontend quedaba esperando
      return res.send({
        messaje: `Hacienda rechazó el documento (004): ${_respuestaMH.descripcionMsg || ""}`.trim(),
        result: false,
        success: false,
        hacienda: false,
      });
    } else {
      if (_respuestaMH.estado === "RECHAZADO") {
        try {
                     //  await fac01(_factura);
            logger.debug("Debug empresa", { controller: "dte_14", action: "postDte14" });
          const fileName = path.join(
            __dirname,
            `../../storage/json/${empresa[0].esquemaBD}/dte14/rechazados/${_ano}/`
          );
          const newfile = fileName + `${_ide.numeroControl}.json`;

          fs.mkdirSync(path.dirname(newfile), { recursive: true });
          fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
          await emailRechazo(
            _ide.numeroControl,
            process.env.DTE_CORREO,
            "dte14",
            _ano,
	    empresa[0].esquemaBD
          );

          res.send({
            success: false,
            result: "Procesado en Hacienda Rechazado",
            hacienda: false,
          });
          return;
        } catch (error) {
          logger.error(`Error al registrar rechazo DTE 14: ${error.message}`, { controller: "dte_14", action: "postDte14" });
          // El rechazo ya quedó guardado; falló el archivo o el correo. Igual se responde.
          return res.send({
            success: false,
            result: "Procesado en Hacienda Rechazado",
            hacienda: false,
          });
        }
        //enviamos correo a contabilidad para que corrigan porque esta rechazado
      } else if (_respuestaMH.estado == "PROCESADO") {
        //enviasmos correo a cliente y pdf
        await generaPdf14(_form.aplicacion.dte,_ano,_empresa);
        //await fac03(_factura);
        //await fac01(_factura);
        logger.debug("Debug empresa", { controller: "dte_14", action: "postDte14" });

        const fileName = path.join(
          __dirname,
          `../../storage/json/${empresa[0].esquemaBD}/dte14/aceptados/${_ano}/`
        );
        const newfile = fileName + `${_ide.numeroControl}.json`;

        fs.mkdirSync(path.dirname(newfile), { recursive: true });
        fs.writeFileSync(newfile, JSON.stringify(JsonCliente));
        await emailEnviado(
          _ide.numeroControl,
          // El correo guardado, como antes (en el JSON v2 puede ir null)
          _subjectoE[0].correo,
          "factura@coagro.com",
	 _subj.nombre,
          "dte14",
          _ano,
	_empresa
        );
        //guardamos en CP
        if (_form.origen === "CP") {
          const _documetoCp = await sequelize.query(
            `EXEC dte.dbo.dte_DocumentosCPSujetoExcludio ${dte[0].Dte_id},'FAC','${_ide.fecEmi}','${_ide.fecEmi}','${_cuer.descripcion}','30',15,'${_ide.fecEmi}','4','${_respuestaMH.selloRecibido}','${empresa[0].esquemaBD}'`,
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
      } else {
        // Respuesta sin estado conocido (ej. error de validación de Hacienda): antes no se respondía
        logger.warn(`Respuesta MH sin estado esperado: ${JSON.stringify(_respuestaMH).slice(0, 500)}`, {
          controller: "dte_14",
          action: "postDte14",
        });
        return res.send({
          messaje: `Hacienda no procesó el documento: ${_respuestaMH.descripcionMsg || _respuestaMH.estado || "sin detalle"}`,
          result: false,
          success: false,
          hacienda: false,
        });
      }
    }
  }
 } catch (error) {
   await notifyError("dte_14", "postDte14", error);
   if (res && !res.headersSent) {
     res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
   }
 }
};
// ---------------------------------------------------------------------
// Reglas del receptor en FSE v2 (config/schemas/v2/fe-fse-v2.json):
//   telefono: null o 8..30 caracteres; correo: null o 6..100 caracteres.
//   Un texto vacío o corto NO es válido: se manda null.
//   direccion: departamento, municipio y distrito con 2 dígitos (CAT-012/013/008).
// ---------------------------------------------------------------------
const textoMh = (valor, minimo, maximo) => {
  const texto = valor === null || valor === undefined ? "" : String(valor).trim();
  return texto.length >= minimo ? texto.slice(0, maximo) : null;
};
const correoMh = (valor) => {
  const correo = textoMh(valor, 6, 100);
  return correo && correo.indexOf("@") > 0 ? correo : null;
};
// Código del ERP a formato MH: "0623" -> "23", "06" -> "06"
const codigoMh = (valor) => {
  const texto = valor === null || valor === undefined ? "" : String(valor).trim();
  return texto ? texto.slice(-2) : null;
};

// Dirección del proveedor en formato MH v2 a partir de una fila de dte_proveedor
// (columnas _MH de la Fase 1; si no están, se derivan de DIVISION_GEOGRAFICA1/2/3).
const direccionProveedorMh = (p, complementoActual) => ({
  departamento: p.DEPTO_MH || codigoMh(p.DIVISION_GEOGRAFICA1),
  municipio: p.MUNI_MH || codigoMh(p.DIVISION_GEOGRAFICA2),
  distrito: p.DISTRITO_MH || codigoMh(p.DIVISION_GEOGRAFICA3),
  complemento:
    p.DIRECCION_MH ||
    textoMh(String(p.DIRECCION || "").replace("DETALLE:", ""), 1, 200) ||
    complementoActual,
});

// v1: dirección tal como la manda el formulario (sin cambios).
// v2: usa direccionMh del formulario (ya en formato MH); si no viene (frontend
//     anterior), recorta los códigos del ERP a 2 dígitos.
const subjectoexculido = async (_factura, v2 = false) => {
  let tipo = "";
  if (_factura.numDocumento.length > 9) {
    tipo = "36";
  } else {
    tipo = "13";
  }

  const dir = _factura.direccion || {};
  const mh = _factura.direccionMh || {};
  const direccion = v2
    ? {
        departamento: mh.departamento || codigoMh(dir.departamento),
        municipio: mh.municipio || codigoMh(dir.municipio),
        distrito: mh.distrito || codigoMh(dir.distrito),
        complemento: textoMh(mh.complemento || dir.complemento, 1, 200),
      }
    : {
        departamento: dir.departamento,
        municipio: dir.municipio,
        complemento: dir.complemento,
      };

  return {
    tipoDocumento: tipo,
    numDocumento: _factura.numDocumento.replaceAll("-", ""),
    nombre: _factura.nombre,
    codActividad: null,
    descActividad: null,
    direccion,
    telefono: textoMh(_factura.telefono, 8, 30),
    correo: correoMh(_factura.correo),
  };
};

// Campos de dirección que faltan para FSE v2 (vacío = completa)
const faltantesDireccionV2 = (direccion) =>
  ["departamento", "municipio", "distrito", "complemento"].filter((k) => !direccion || !direccion[k]);
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


