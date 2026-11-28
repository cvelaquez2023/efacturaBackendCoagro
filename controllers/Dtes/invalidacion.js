const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { firmaMH, autorizacionMh } = require("../../config/MH");
const {
  Sqlempresa,
  SqlDteReceptor,
  SqlDteRecptor02,
  SqlDte,
  SqlDteSujetoExcluido,
  SqlDteIdentificacion,
} = require("../../sqltx/sql");
const moment = require("moment");
const doc = require("pdfkit");
const path = require("path");
const { emailInvalidado } = require("../../utils/email");
const { guardarJsonInvalidacion, generaPdfInvalidacion } = require("../../utils/eventoInvalidacion");
const { numeroControl } = require("../../utils/numeroControl");
const { codigoMH, codigosDeNumeroControl } = require("../../utils/dteV2");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");

const postInvalidar = async (req, res) => {
  try {
    const {
      empresa_id,
      documento,
      tipoAnulacion,
      codigoGeneracionR,
      motivoAnulacion,
      nombreResponsable,
      tipoDocResponsable,
      numDocResponsable,
      nombreSolicita,
      numDocSolicita,
      tipoDocSolicita,
    } = req.body;

    // CAT-024: 1 = error en la información y 3 = otro exigen el código de generación
    // del DTE que reemplaza al invalidado; 2 = rescindir la operación no lo lleva.
    const _tipoAnulacion = Number(tipoAnulacion) || 2;
    if (![1, 2, 3].includes(_tipoAnulacion)) {
      return res.send({ success: false, errors: ["Tipo de invalidación no válido (1, 2 o 3)"] });
    }
    const _codigoR =
      _tipoAnulacion === 2 ? null : String(codigoGeneracionR || "").trim().toUpperCase() || null;
    if (_tipoAnulacion !== 2) {
      const formato = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
      if (!_codigoR || !formato.test(_codigoR)) {
        return res.send({
          success: false,
          errors: ["Para este tipo de invalidación indique el código de generación (36 caracteres) del DTE que lo reemplaza"],
        });
      }
    }
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
    if (datos.length === 0) {
      return res.send({ success: false, errors: [`El documento ${documento} no existe para esta empresa`] });
    }

    // El DTE de reemplazo debe existir en esta empresa, estar aceptado por Hacienda
    // y no ser el mismo que se invalida.
    if (_codigoR) {
      if (_codigoR === String(datos[0].codigoGeneracion || "").toUpperCase()) {
        return res.send({ success: false, errors: ["El DTE de reemplazo no puede ser el mismo que se invalida"] });
      }
      const reemplazo = await sequelize.query(
        `select top 1 Dte, tipoDoc, selloRecibido from dte.dbo.DTES
          where upper(codigoGeneracion) = :codigo and Empresa_id = :empresa`,
        { replacements: { codigo: _codigoR, empresa: User[0].empresa }, type: QueryTypes.SELECT }
      );
      if (reemplazo.length === 0) {
        return res.send({ success: false, errors: [`No se encontró un DTE con el código de generación ${_codigoR} en esta empresa`] });
      }
      const sello = String(reemplazo[0].selloRecibido || "").trim();
      if (!sello || sello.toUpperCase() === "ND") {
        return res.send({
          success: false,
          errors: [`El DTE de reemplazo ${reemplazo[0].Dte} aún no ha sido aceptado por Hacienda (sin sello de recepción)`],
        });
      }
    }

    // Un DTE se invalida una sola vez. Sin este control se reenviaba y Hacienda
    // respondía 015 "DOCUMENTO SE ENCUENTRA INVALIDADO".
    const [_estadoInva] = await sequelize.query(
      `select invalidado, selloRecibidoInva, codigoGeneracionInvalidacion,
              convert(varchar, fechaHoraInva, 120) as fechaHoraInva
         from dte.dbo.dtes where Dte_id = :id`,
      { replacements: { id: datos[0].Dte_id }, type: QueryTypes.SELECT }
    );
    if (_estadoInva && Number(_estadoInva.invalidado) === 1) {
      return res.send({
        success: false,
        errors: [
          `El documento ${documento} ya fue invalidado` +
            (_estadoInva.fechaHoraInva ? ` el ${_estadoInva.fechaHoraInva}` : "") +
            (_estadoInva.selloRecibidoInva ? ` (sello ${_estadoInva.selloRecibidoInva})` : ""),
        ],
        yaInvalidado: true,
      });
    }

    const datosDte = await _receptor(datos[0].tipoDoc, datos[0].Dte_id);
    const _idDte = datosDte[0].dte_Id;

    const uuid = require("uuid");
    const _codigoGeneracion = uuid.v4().toUpperCase();
    const fecha = moment();
    const fechaFormateada = fecha.format("YYYY-MM-DD");
    const horaFormateada = fecha.format("HH:mm:ss");

    // Normativa DTE v2.0: evento de invalidación v3
    const _v3 = Number(empresa[0].versionInva) >= 3;

    // Fecha de emisión del DTE tal como se envió a Hacienda (dte.dbo.identificacion).
    // MH la compara: con la fecha de hoy rechazó "[identificacion.fecEmi] DATO NO
    // COINCIDE CON DTE". En pruebas el DTE lleva fecha fija (config/MH.js), por eso
    // no se usa dtes.fechaemision salvo como respaldo.
    const _fecEmiDte = _v3 ? await fechaEmisionEnviada(datos[0].Dte_id, datos[0].fecEmi) : null;

    const _identificacion = _v3
      ? {
          version: Number(empresa[0].versionInva),
          ambiente: empresa[0].ambiente,
          codigoGeneracion: _codigoGeneracion,
          // v3: fecEmi = fecha de emisión del DTE a invalidar (igual que fecAnula en v1)
          fecEmi: _fecEmiDte,
          horEmi: horaFormateada,
          fusion: null, // solo para absorbentes de sociedades fusionadas
        }
      : {
          version: empresa[0].versionInva,
          ambiente: empresa[0].ambiente,
          codigoGeneracion: _codigoGeneracion,
          fecAnula: datos[0].fecEmi,
          horAnula: horaFormateada,
        };

    // Códigos MH con formato S028 / P001: primero los del número de control del
    // documento que se invalida (mismo establecimiento), luego los de la empresa
    // y por último los que MH aceptaba en v1.
    const _codDoc = codigosDeNumeroControl(documento);

    const _emisor = _v3
      ? {
          nit: empresa[0].nit,
          nombre: empresa[0].nombre,
          codEstableMH: codigoMH("estable", [_codDoc.estable, empresa[0].codestableceMh], "M001"),
          codEstable: empresa[0].codestable ? String(empresa[0].codestable).trim() : null,
          codPuntoVentaMH: codigoMH("puntoVenta", [_codDoc.puntoVenta, empresa[0].codPuntoVentaMh], "P001"),
          codPuntoVenta: empresa[0].codPuntoVenta ? String(empresa[0].codPuntoVenta).trim() : null,
          telefono: empresa[0].telefono,
          correo: empresa[0].correoDte,
        }
      : {
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
      numeroControl: _v3 ? numeroControl(documento) : documento.replace(_ano2, "-"),
      fecEmi: _v3 ? _fecEmiDte : datos[0].fecEmi,
      montoIva: iva,
      codigoGeneracionR: _codigoR,
      tipoDocumento: _tipoDo,
      numDocumento: _dui,
      nombre: datosDte[0].nombre,
      telefono: datosDte[0].telefono,
      correo: datosDte[0].correo,
    };
    // v3 ya no lleva montoIva
    if (_v3) delete _documento.montoIva;

    const _motivo = {
      tipoAnulacion: _tipoAnulacion,
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
        // Antes iba siempre a producción, aun con ambiente de pruebas
        const url =
          empresa[0].ambiente === "00"
            ? "https://apitest.dtes.mh.gob.sv/fesv/anulardte"
            : "https://api.dtes.mh.gob.sv/fesv/anulardte";
        const response = await fetch(url, requestOptions);
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

        // 015: Hacienda ya lo tiene invalidado (p. ej. un intento anterior que no
        // quedó registrado). Se marca en BD solo si no estaba, para no borrar el
        // sello de la invalidación original.
        const _yaInvalidadoMH =
          _respuestaMH.codigoMsg === "015" ||
          String(_respuestaMH.descripcionMsg || "").toUpperCase().includes("SE ENCUENTRA INVALIDADO");
        if (_yaInvalidadoMH) {
          await sequelize.query(
            `update dte.dbo.dtes set invalidado = 1, estadoIvalidacion = 'INVALIDADO EN MH',
                    fechaHoraInva = isnull(fechaHoraInva, getdate())
              where Dte_id = :id and isnull(invalidado, 0) = 0`,
            { replacements: { id: _idDte } }
          );
          res.send({
            errors: [`El documento ${documento} ya se encuentra invalidado en Hacienda`],
            result: _respuestaMH,
            success: false,
            yaInvalidado: true,
          });
          return;
        }

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
      // Normativa DTE v2.0: entregar al receptor el archivo del evento y su
      // representación gráfica. La invalidación ya tiene sello: si algo de esto
      // falla se informa, pero la respuesta sigue siendo exitosa.
      const _numeroControlDte = numeroControl(documento);
      const _esquema = empresa[0].esquemaBD;
      let _correo = { ok: false, error: "No se generaron los archivos del evento" };
      try {
        const jsonEvento = guardarJsonInvalidacion({
          esquema: _esquema,
          ano: _ano,
          numeroControlDte: _numeroControlDte,
          evento: datosJs,
          firma: _firma,
          respuestaMH: _respuestaMH,
        });
        const pdfEvento = await generaPdfInvalidacion({
          esquema: _esquema,
          ano: _ano,
          numeroControlDte: _numeroControlDte,
          evento: datosJs,
          respuestaMH: _respuestaMH,
          empresa,
        });
        const pdfDte = path.join(
          __dirname,
          `../../storage/pdf/${_esquema}/dte${datos[0].tipoDoc}/${_ano}/${_numeroControlDte}.pdf`
        );
        _correo = await emailInvalidado({
          numeroControlDte: _numeroControlDte,
          email: datosDte[0].correo,
          nombreCliente: datosDte[0].nombre,
          empresa,
          jsonEvento,
          pdfEvento,
          pdfDte,
        });
      } catch (error) {
        _correo = { ok: false, error: error.message };
        logger.error(`Invalidación ${_numeroControlDte}: error con archivos/correo del evento: ${error.message}`, {
          controller: "invalidacion",
          action: "postInvalidar",
        });
      }
      res.send({
        errors: ["Procesado en Hacienda Aceptados"],
        result: "Procesado en Hacienda Aceptados",
        success: true,
        hacienda: true,
        correo: _correo.ok
          ? "Evento de invalidación enviado al receptor"
          : `No se pudo enviar el evento al receptor: ${_correo.error}`,
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

// "YYYY-MM-DD" desde Date (columna date/datetime) o texto, sin corrimiento de zona
const aFechaISO = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return moment.utc(valor).format("YYYY-MM-DD");
  const texto = String(valor).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.substring(0, 10) : null;
};

// fecEmi con que el DTE se transmitió a Hacienda. Si hay varios intentos
// guardados, el último es el que obtuvo el sello.
const fechaEmisionEnviada = async (idDte, respaldo) => {
  try {
    const filas = await SqlDteIdentificacion(idDte);
    const ultima = filas.length ? aFechaISO(filas[filas.length - 1].fecEmi) : null;
    return ultima || aFechaISO(respaldo) || respaldo;
  } catch (error) {
    return aFechaISO(respaldo) || respaldo;
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
