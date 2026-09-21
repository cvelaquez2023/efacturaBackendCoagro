const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { firmaMH, autorizacionMh } = require("../../config/MH");
const {
  Sqlempresa,
  SqlDteReceptor,
  SqlDteRecptor02,
  SqlDte,
  SqlDteSujetoExcluido,
} = require("../../sqltx/sql");
const moment = require("moment");
const doc = require("pdfkit");
const { emailInvalidado } = require("../../utils/email");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");

const postInvalidar = async (req, res) => {
  try {
    const {
      empresa_id,
      documento,
      tipoAnulacion,
      motivoAnulacion,
      nombreResponsable,
      tipoDocResponsable,
      numDocResponsable,
      nombreSolicita,
      numDocSolicita,
      tipoDocSolicita,
    } = req.body;
    let estado = "";
    const _parte1 =documento.substring(16, 18) ;
    const _ano = '20'+_parte1;
    const User = req.cliente;
    const empresa = await Sqlempresa(User[0].empresa);
    const HayContingencia = empresa[0].Contingencia;

    if (empresa.length == 0) {
      return res
        .status(400)
        .send({ messaje: "Empresa No existe o no esta activa" });
    }
    if (HayContingencia) {
      return res.status(400).send({ messaje: "Sitio esta en Contingencia" });
    }

    const datos = await SqlDte(documento, User[0].empresa);
    const datosDte = await _receptor(datos[0].tipoDoc, datos[0].Dte_id);
    const _idDte = datosDte[0].dte_Id;

    const uuid = require("uuid");
    const _codigoGeneracion = uuid.v4().toUpperCase();
    const fecha = moment();
    const fechaFormateada = fecha.format("YYYY-MM-DD");
    const horaFormateada = fecha.format("HH:mm:ss");

    const _identificacion = {
      version: empresa[0].versionInva,
      ambiente: empresa[0].ambiente,
      codigoGeneracion: _codigoGeneracion,
      fecAnula: fechaFormateada,
      horAnula: horaFormateada,
    };

    const _emisor = {
      nit: empresa[0].nit,
      nombre: empresa[0].nombre,
      tipoEstablecimiento: empresa[0].tipoestablecimiento,
      nomEstablecimiento: empresa[0].nombreComercial,
      codEstableMH: "M001",
      codEstable: empresa[0].codestable,
      codPuntoVentaMH: "P001",
      codPuntoVenta: empresa[0].codPuntoVenta,
      telefono: empresa[0].telefono,
      correo: empresa[0].correoDte,
    };
    if (datos[0].tipoDoc === "11") {
      _dui = datosDte[0].nit;
      _tipoDo = "37";
    } else {
      if (datosDte[0].nit.length === 14 || datosDte[0].nit.length === 17) {
        _dui = datosDte[0].nit;
        _tipoDo = "36";
      } else if (datosDte[0].nit.length === 9 || datosDte[0].nit.length === 10) {
        _tipoDo = "13";
        _dui = datosDte[0].nit;
      } else {
        _tipoDo = "37";
        _dui = datosDte[0].nit;
      }
    }

    let iva = 0.0;
    if (datos[0].tipoDoc === "01") {
      iva = 0.0;
    } else {
      iva = parseFloat(datos[0].montoTotal);
    }

    const _ano1=documento.substring(16, 18)
    const _ano2='-'+_ano1+'-'
    const _documento = {
      tipoDte: datos[0].tipoDoc,
      codigoGeneracion: datos[0].codigoGeneracion,
      selloRecibido: datos[0].selloRecibido,
      numeroControl: documento.replace(_ano2, "-"),
      fecEmi: datos[0].fecEmi,
      montoIva: iva,
      codigoGeneracionR: null,
      tipoDocumento: _tipoDo,
      numDocumento: _dui,
      nombre: datosDte[0].nombre,
      telefono: datosDte[0].telefono,
      correo: datosDte[0].correo,
    };

    const _motivo = {
      tipoAnulacion: tipoAnulacion,
      motivoAnulacion: motivoAnulacion,
      nombreResponsable: nombreResponsable,
      tipDocResponsable: tipoDocResponsable,
      numDocResponsable: numDocResponsable,
      nombreSolicita: nombreSolicita,
      tipDocSolicita: tipoDocSolicita,
      numDocSolicita: numDocSolicita,
    };
    const datosJs = {
      identificacion: _identificacion,
      emisor: _emisor,
      documento: _documento,
      motivo: _motivo,
    };
    const datafirma = {
      nit: empresa[0].nit,
      activo: true,
      passwordPri: empresa[0].pwdPrivado,
      dteJson: datosJs,
    };

    const _firma = await firmaMH(datafirma, empresa);
    const datos3 = {
      json: datosJs,
      _firma,
    };

    const _auth = await autorizacionMh(User[0].empresa);
    _token = _auth.token;

    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", _token);

    var raw = JSON.stringify({
      ambiente: empresa[0].ambiente,
      idEnvio: 1,
      version: empresa[0].versionInva,
      documento: _firma,
    });

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const postInvaliddardte = async () => {
      try {
        const response = await fetch(
          "https://api.dtes.mh.gob.sv/fesv/anulardte",
          requestOptions
        );
        const data = await response.json();
        return data;
      } catch (error) {
        logger.error("Error en postInvaliddardte", { controller: "invalidacion", action: "postInvaliddardte", stack: error.stack });
      }
    };

    const _respuestaMH = await postInvaliddardte();
    if (_respuestaMH.estado === "RECHAZADO") {
      try {
        const respuestaMhId = await sequelize.query(
          `select Max(respuestamh_id) as id from dte.dbo.respuestamh where dte_id=${_idDte}`,
          { type: QueryTypes.SELECT }
        );

        let _respuestaMHId = 0;
        if (respuestaMhId.length > 0) {
          _respuestaMHId = respuestaMhId[0].id;
        } else {
          _respuestaMHId = 0;
        }

        await sequelize.query(
          `insert into dte.dbo.observaciones(dte_id,respuestamh_id,descripcion) values (${_idDte},${_respuestaMHId},'${_respuestaMH.descripcionMsg}')`,
          { type: QueryTypes.SELECT }
        );
        logger.info("Invalidacion rechazada", { controller: "invalidacion", action: "postInvalidar", extra: JSON.stringify(_respuestaMH) });
        res.send({
          errors: ["Error al enviar Invalidacion"],
          result: _respuestaMH,
          success: false,
        });
        return;
      } catch (error) {
        logger.error("Error procesando rechazo de invalidacion", { controller: "invalidacion", action: "postInvalidar_rechazo", stack: error.stack });
      }
    } else if (_respuestaMH.estado === "PROCESADO") {
      await sequelize.query(
        `update dte.dbo.dtes set selloRecibidoInva='${_respuestaMH.selloRecibido}',fechaHoraInva=getdate(),invalidado=1,codigoGeneracionInvalidacion='${_respuestaMH.codigoGeneracion}',estadoIvalidacion='${_respuestaMH.estado}' where Dte_id= ${_idDte}`,
        { type: QueryTypes.SELECT }
      );
      const _parte1 =documento.substring(0, 15);
      const _parte2 =documento.substring(19, 34);
      const doc = _parte1 + "-" + _parte2;
      const tipo = doc.substring(4, 6);
      const tipoDoc = "dte" + tipo;
      await emailInvalidado(doc, datosDte[0].correo, tipoDoc,_ano,empresa);
      res.send({
        errors: ["Procesado en Hacienda Aceptados"],
        result: "Procesado en Hacienda Aceptados",
        success: true,
        hacienda: true,
      });
    } else if (_respuestaMH.estado === null) {
      res.send({
        result: "problema Ministerio Haicenda",
        errors: [_respuestaMH.descripcionMsg],
        success: false,
      });
    }
  } catch (error) {
    await notifyError("invalidacion", "postInvalidar", error, "Documento: " + req.body.documento);
    if (res && !res.headersSent) {
      res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
    }
  }
};

const _receptor = async (tipoDoc, idDte) => {
  if (
    tipoDoc === "03" ||
    tipoDoc === "05" ||
    tipoDoc === "01" ||
    tipoDoc === "11"
  ) {
    const datosDte = await SqlDteReceptor(idDte);
    return datosDte;
  }
  if (tipoDoc === "14") {
    const datoSuje = await SqlDteSujetoExcluido(idDte);
    return datoSuje;
  }
};

module.exports = postInvalidar;
