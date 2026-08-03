const doc = require("pdfkit");
const { Sqlempresa, SqlDte } = require("../../sqltx/sql");
const moment = require("moment");
const { firmaMH, autorizacionMh } = require("../../config/MH");
const contingencia = async (req, res) => {
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

  const dataDte = await SqlDte(documento);

  const empresa = await Sqlempresa(empresa_id);

  if (empresa.length == 0) {
    return res
      .status(400)
      .send({ messaje: "Empresa No existe o no esta activa" });
  }

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
   // codEstable: empresa[0].codestable,
   // codPuntoVenta: empresa[0].codPuntoVenta,
    telefono: empresa[0].telefono,
    correo: empresa[0].correoDte,
  };

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
    tipoContingencia: tipoContingencia,
    motivoContingencia: motivoContingencia,
  };
  const dte = {
    identificacion: _identificacion,
    emisor: _emisor,
    detalleDTE: _detalleDte,
    motivo: _motivo,
  };
  const datafirma = {
    nit: process.env.DTE_NIT,
    activo: true,
    passwordPri: process.env.DTE_PWD_PRIVADA,
    dteJson: dte,
  };

  const _firma = await firmaMH(datafirma);

  //traermos la autorizacion de mh
  const _auth = await autorizacionMh();
  _token = _auth.token;

  //enviamos el documento a la direccion del ministerio de Hacienda para que nos regrese el sello
  var myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", _token);

  var raw = JSON.stringify({
    nit: process.env.DTE_NIT,
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
      const response = await fetch(
        "https://apitest.dtes.mh.gob.sv/fesv/contingencia",
        requestOptions
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.log("error", error);
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
};

module.exports = { contingencia };
