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

const postInvalidar = async (req, res) => {
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
  //consultados datos del dte

  const empresa = await Sqlempresa(empresa_id);
  const HayContingencia = empresa[0].Contingencia;

  if (empresa.length == 0) {
    return res
      .status(400)
      .send({ messaje: "Empresa No existe o no esta activa" });
  }
  if (HayContingencia) {
    return res.status(400).send({ messaje: "Sitio esta en Contingencia" });
  }

  const datos = await SqlDte(documento);

  /*
  const datosDte = await sequelize.query(
    `select * from dte.dbo.receptor where  dte_id='${datos[0].Dte_id}'`,
    { type: QueryTypes.SELECT }
  );
  */

  //const datosDte = await SqlDteReceptor(datos[0].Dte_id);
  const datosDte = await _receptor(datos[0].tipoDoc, datos[0].Dte_id);
  const _idDte = datosDte[0].dte_Id;
  //const _idDte = datos[0].Dte_id

  const uuid = require("uuid");
  const _codigoGeneracion = uuid.v4().toUpperCase();
  const fecha = moment();
  const fechaFormateada = fecha.format("YYYY-MM-DD");
  const horaFormateada = fecha.format("HH:mm:ss");

  const _identificacion = {
    version: empresa[0].VersionInva,
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

  const _documento = {
    tipoDte: datos[0].tipoDoc,
    codigoGeneracion: datos[0].codigoGeneracion,
    selloRecibido: datos[0].selloRecibido,
    numeroControl: documento.replace("-25-", "-"),
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
    nit: process.env.DTE_NIT,
    activo: true,
    passwordPri: process.env.DTE_PWD_PRIVADA,
    dteJson: datosJs,
  };

  const _firma = await firmaMH(datafirma);
  const datos3 = {
    json: datosJs,
    _firma,
  };

  //traermos la autorizacion de mh

  const _auth = await autorizacionMh();
  _token = _auth.token;

  //enviamos el documento a la direccion del ministerio de Hacienda para que nos regrese el sello
  var myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", _token);

  var raw = JSON.stringify({
    ambiente: process.env.DTE_AMBIENTE,
    idEnvio: 1,
    version: empresa[0].VersionInva,
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
        //"https://apitest.dtes.mh.gob.sv/fesv/anulardte",
        requestOptions
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.log("error", error);
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

      for (let d = 0; d < _respuestaMH.observaciones.length; d++) {
        const el = _respuestaMH.observaciones[d];

        await sequelize.query(
          `insert into dte.dbo.observaciones(dte_id,respuestamh_id,descripcion) values (${_idDte},${_respuestaMHId},'${el}')`,
          { type: QueryTypes.SELECT }
        );
      }

      res.send = { result: _respuestaMH, success: false };
    } catch (error) {
      console.log(error);
    }
    //enviamos correo a contabilidad para que corrigan porque esta rechazado
  } else if (_respuestaMH.estado === "PROCESADO") {
    await sequelize.query(
      `update dte.dbo.dtes set selloRecibidoInva='${_respuestaMH.selloRecibido}',fechaHoraInva=getdate(),invalidado=1,codigoGeneracionInvalidacion='${_respuestaMH.codigoGeneracion}',estadoIvalidacion='${_respuestaMH.estado}' where Dte_id= ${_idDte}`,
      { type: QueryTypes.SELECT }
    );
    //Consultados correo del cliente

    const doc = documento.replace("-25-", "-");
    const tipo = doc.substring(4, 6);
    const tipoDoc = "dte" + tipo;
    await emailInvalidado(doc, datosDte[0].correo, tipoDoc);
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
