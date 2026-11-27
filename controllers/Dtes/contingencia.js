const doc = require("pdfkit");
const { Sqlempresa, SqlDte } = require("../../sqltx/sql");
const moment = require("moment");
const { firmaMH, autorizacionMh } = require("../../config/MH");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");

const contingencia = async (req, res) => {
  try {
    const {
      documento,
      Finicio,
      Ffin,
      Hinicio,
      Hfin,
      tipoContingencia,
      motivoContingencia,
      empresa_id,
    } = req.body;

    const empresa = await Sqlempresa(empresa_id);

    if (empresa.length == 0) {
      return res
        .status(400)
        .send({ messaje: "Empresa No existe o no esta activa" });
    }
    // Antes se buscaba sin empresa y nunca encontraba el DTE
    const dataDte = await SqlDte(documento, empresa_id);
    if (dataDte.length === 0) {
      return res
        .status(400)
        .send({ messaje: "Documento no existe para esta empresa" });
    }
    // Normativa DTE v2.0: evento de contingencia v4
    const _v4 = Number(empresa[0].versionConting) >= 4;

    const uuid = require("uuid");
    const _codigoGeneracion = uuid.v4().toUpperCase();
    const fecha = moment();
    const fechaFormateada = fecha.format("YYYY-MM-DD");
    const horaFormateada = fecha.format("HH:mm:ss");

    const _identificacion = {
      version: empresa[0].versionConting,
      ambiente: empresa[0].ambiente,
      codigoGeneracion: _codigoGeneracion,
      fTransmision: fechaFormateada,
      hTransmision: horaFormateada,
    };
    const _emisor = {
      nit: empresa[0].nit,
      nombre: empresa[0].nombre,
      nombreResponsable: process.env.DTE_NOMBRERESPONSABLE,
      tipoDocResponsable: "13",
      numeroDocResponsable: process.env.DTE_DOCRESPONSABLE,
      tipoEstablecimiento: empresa[0].tipoestablecimiento,
      telefono: empresa[0].telefono,
      correo: empresa[0].correoDte,
    };
    if (_v4) {
      _identificacion.version = Number(empresa[0].versionConting);
      _emisor.codEstableMH = empresa[0].codestableceMh || null;
      _emisor.codPuntoVentaMH = empresa[0].codPuntoVentaMh || null;
    }

    const _detalleDte = [
      {
        noItem: 1,
        tipoDoc: dataDte[0].tipoDoc,
        codigoGeneracion: dataDte[0].codigoGeneracion,
      },
    ];
    const _motivo = {
      fInicio: Finicio,
      fFin: Ffin,
      hInicio: Hinicio,
      hFin: Hfin,
      tipoContingencia: _v4 ? Number(tipoContingencia) : tipoContingencia,
      motivoContingencia: motivoContingencia,
    };
    const dte = {
      identificacion: _identificacion,
      emisor: _emisor,
      detalleDTE: _detalleDte,
      motivo: _motivo,
    };
    // Firma y autorización con los datos de la empresa (antes .env y sin
    // empresa: firmaMH devolvía "ERROR" y autorizacionMh fallaba)
    const datafirma = {
      nit: empresa[0].nit,
      activo: true,
      passwordPri: empresa[0].pwdPrivado,
      dteJson: dte,
    };

    const _firma = await firmaMH(datafirma, empresa);
    if (_firma === "ERROR") {
      return res.send({
        messaje: "Es Servidor de Firma no responde",
        result: false,
      });
    }
    const _auth = await autorizacionMh(empresa_id);
    if (_auth === "ERROR" || !_auth?.token) {
      return res.send({
        messaje: "Problema con autenticacion de hacienda",
        result: false,
      });
    }
    const _token = _auth.token;

    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", _token);

    var raw = JSON.stringify({
      nit: empresa[0].nit,
      documento: _firma,
    });

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const postContingencia = async () => {
      try {
        // Antes iba siempre a pruebas, aun en producción
        const url =
          empresa[0].ambiente === "01"
            ? "https://api.dtes.mh.gob.sv/fesv/contingencia"
            : "https://apitest.dtes.mh.gob.sv/fesv/contingencia";
        const response = await fetch(url, requestOptions);
        const data = await response.json();
        return data;
      } catch (error) {
        logger.error("Error en postContingencia", { controller: "contingencia", action: "postContingencia", stack: error.stack });
      }
    };

    const _respuestaMH = await postContingencia();
    const data = {
      json: dte,
      _firma,
      _respuestaMH,
    };
    res.send(data);
    return;
  } catch (error) {
    await notifyError("contingencia", "contingencia", error, "Documento: " + req.body.documento);
    if (res && !res.headersSent) {
      res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
    }
  }
};

module.exports = { contingencia };
