const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const {
  SqlDeleteDts,
  SqlDte,
  SqlFactura,
  SqlDireEmbarque,
  SqlCliente,
  SqlDocumentoCC,
  Sqlempresa,
} = require("./sql");
const moment = require("moment");

const guardarDte = async (datos,empresa) => {
  try {
    const _fecha = moment
      .tz(datos.FECHAFULL, "America/El_Salvador")
      .format("YYYY-MM-DD HH:mm:ss");
   
      const dte_id = await SqlDte(datos.dte,empresa);
    if (dte_id.length == 0) {
      await sequelize.query(
        `insert into dte.dbo.dtes(dte,createDate,origen,nombre,procesado,mudulo,tipoDoc,selloRecibido,codigoGeneracion,estado,fechaemision,montoTotal,documento, Empresa_id,firma,usuario_Id) values('${datos.dte}','${_fecha}','${datos.origen}','${datos.nombre}',0,'${datos.modulo}', '${datos.tipoDoc}','ND','${datos.codigoGeneracion}','${datos.estado}','${_fecha}',${datos.montoTotal},'${datos.Documento}',${datos.Empresa_id},'${datos.firma}',${datos.usuario_Id})`,
        { type: QueryTypes.SELECT }
      );
    } else {
      //borramos el detalle de todo menos las observaciones
      await SqlDeleteDts(dte_id[0].Dte_id);
      await sequelize.query(
        `update dte.dbo.dtes set codigoGeneracion='${datos.codigoGeneracion}' where Dte_Id=${dte_id[0].Dte_id}`,
        { type: QueryTypes.SELECT }
      );
    }

    return "Se gurdaro con existo";
  } catch (error) {
    console.log(error);
    return "Existio un problema";
  }
};

const guardarDocumentoRelacionas = async (datos, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    for (let index = 0; index < datos.length; index++) {
      const element = datos[index];
      await sequelize.query(
        `insert into dte.dbo.documentoRelacionado(dte_id,tipoDocumento,tipoGeneracion,numeroDocumento,fechaEmision) values(${id[0].Dte_id},'${element.tipoDocumento}',${element.tipoGeneracion},'${element.numeroDocumento}', '${element.fechaEmision}')`,
        { type: QueryTypes.SELECT }
      );
    }
  } catch (error) {
    console.log(error);
  }
};

const guardarIdentificacion = async (identificacion, factura,empresa) => {
  //const id = await dte(identificacion.numeroControl);

  const id = await dte(factura,empresa);

  
  try {
    await sequelize.query(
      `insert into dte.dbo.identificacion(Dte_id,version,ambiente,tipoDte,numeroControl,codigoGeneracion,tipoModelo,tipoOPeracion,fecEmi,horEmi,tipoMoneda) values(${id[0].Dte_id},${identificacion.version},'${identificacion.ambiente}', '${identificacion.tipoDte}', '${identificacion.numeroControl}','${identificacion.codigoGeneracion}',${identificacion.tipoModelo},${identificacion.tipoOperacion},'${identificacion.fecEmi}','${identificacion.horEmi}','${identificacion.tipoMoneda}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};

const guardarEmision = async (emisor, factura,empresa) => {
  const id = await dte(factura,empresa);
  let codEstableMH,
    codEstable,
    codPuntoVentaMH,
    codPuntoVenta,
    nombreComercial,
    tipoEstablecimiento;

  if (emisor.tipoEstablecimiento === undefined) {
    tipoEstablecimiento = "01";
  } else {
    tipoEstablecimiento = emisor.tipoEstablecimiento;
  }

  if (emisor.nombreComercial === undefined) {
    nombreComercial = null;
  } else {
    nombreComercial = emisor.nombreComercial;
  }
  if (emisor.codEstableMH === undefined) {
    codEstableMH = null;
  } else {
    codEstableMH = emisor.codEstableMH;
  }
  if (emisor.codEstable === undefined) {
    codEstable = null;
  } else {
    codEstable = emisor.codEstable;
  }
  if (emisor.codPuntoVentaMH === undefined) {
    codPuntoVentaMH = null;
  } else {
    codPuntoVentaMH = emisor.codPuntoVentaMH;
  }
  if (emisor.codPuntoVenta === undefined) {
    codPuntoVenta = null;
  } else {
    codPuntoVenta = emisor.codPuntoVenta;
  }

  try {
    await sequelize.query(
      `insert into dte.dbo.emisor(dte_id,nit,nrc,nombre,codActividad,descActividad,nombreComercial,tipoEstablecimiento,direccion_depa,direccion_muni,direccion_compl,telefono,correo,codEstableMH,codEstable,codPuntoVentaMH,codPuntoVenta) values(${id[0].Dte_id},'${emisor.nit}','${emisor.nrc}','${emisor.nombre}','${emisor.codActividad}','${emisor.descActividad}','${nombreComercial}','${tipoEstablecimiento}','${emisor.direccion.departamento}','${emisor.direccion.municipio}','${emisor.direccion.complemento}','${emisor.telefono}','${emisor.correo}','${codEstableMH}','${codEstable}','${codPuntoVentaMH}','${codPuntoVenta}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};
const guardarReceptor = async (receptor, factura,empresa) => {
  const id = await dte(factura,empresa);

  let departamento,
    municipio,
    complemento,
    nit,
    nombreComercial,
    codActividad,
    nrc;

  if (receptor.direccion === undefined || receptor.direccion === null) {
    departamento = "ND";
    municipio = "ND";
    complemento = "ND";
  } else {
    departamento = receptor.direccion.departamento;
    municipio = receptor.direccion.municipio;
    complemento = receptor.direccion.complemento;
  }
  if (receptor.nit === undefined) {
    nit = receptor.numDocumento;
  } else {
    nit = receptor.nit;
  }
  if (receptor.codActividad === undefined) {
    codActividad = "";
  } else {
    codActividad = receptor.codActividad;
  }
  if (receptor.nrc === undefined || receptor.nrc === "ND") {
    nrc = null;
  } else {
    nrc = receptor.nrc;
  }
  if (receptor.nombreComercial === undefined) {
    nombreComercial = "ND";
  } else {
    nombreComercial = receptor.nombreComercial;
  }

  try {
    await sequelize.query(
      `insert into dte.dbo.receptor(dte_id,nit,nrc,nombre,codActividad,descActividad,nombreComercial,direccion_depa,direccion_muni,direccion_compl,telefono,correo) values (${id[0].Dte_id},'${nit}','${nrc}','${receptor.nombre}','${codActividad}','${receptor.descActividad}','${nombreComercial}','${departamento}','${municipio}','${complemento}','${receptor.telefono}','${receptor.correo}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};
const guardarSubjectoExcluido = async (receptor, factura,empresa) => {
  const id = await dte(factura,empresa);

  let departamento,
    municipio,
    complemento,
    nit,
    nombreComercial,
    codActividad,
    nrc;

  if (receptor.direccion === undefined || receptor.direccion === null) {
    departamento = "ND";
    municipio = "ND";
    complemento = "ND";
  } else {
    departamento = receptor.direccion.departamento;
    municipio = receptor.direccion.municipio;
    complemento = receptor.direccion.complemento;
  }
  if (receptor.nit === undefined) {
    nit = receptor.numDocumento;
  } else {
    nit = receptor.nit;
  }
  if (receptor.codActividad === undefined) {
    codActividad = "";
  } else {
    codActividad = receptor.codActividad;
  }
  if (receptor.nrc === undefined) {
    nrc = "";
  } else {
    nrc = receptor.nrc;
  }
  if (receptor.nombreComercial === undefined) {
    nombreComercial = "ND";
  } else {
    nombreComercial = receptor.nombreComercial;
  }

  try {
    await sequelize.query(
      `insert into dte.dbo.subjetoExcluido(dte_id,tipoDocumento,nit,nombre,codActividad,descActividad,direccion_depa,direccion_muni,direccion_compl,telefono,correo) values (${id[0].Dte_id},'${receptor.tipoDocumento}', '${nit}','${receptor.nombre}','${codActividad}','${receptor.descActividad}','${departamento}','${municipio}','${complemento}','${receptor.telefono}','${receptor.correo}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};

const guardarventaTercero = async (datos) => {};
const guardarcueroDocumento = async (_cuerpoDoc, factura, tipo,empresa) => {
  const id = await dte(factura,empresa);
  try {
    //insertamos cuerpo documento
    let psv,
      noGravado,
      tipoItem,
      numeroDocumento,
      ventaNoSuj,
      ventaExenta,
      ventaGravada,
      tipoDte,
      tipoDoc,
      fechaEmision,
      montoSujetoGrav,
      codigoRetencionMH,
      ivaRetenido,
      numDocumento,
      codigo,
      cantidad,
      uniMedida,
      precioUni,
      montoDescu,
      lote,
      compra;

    for (let xx = 0; xx < _cuerpoDoc.length; xx++) {
      const element = _cuerpoDoc[xx];

      if (element.compra === undefined) {
        compra = 0.0;
      } else {
        compra = element.compra;
      }
      if (element.lote === undefined) {
        lote = "ND";
      } else {
        lote = element.lote;
      }
      if (element.montoDescu === undefined) {
        montoDescu = 0.0;
      } else {
        montoDescu = element.montoDescu;
      }
      if (element.precioUni === undefined) {
        precioUni = 0.0;
      } else {
        precioUni = element.precioUni;
      }
      if (element.uniMedida === undefined) {
        uniMedida = 0.0;
      } else {
        uniMedida = element.uniMedida;
      }

      if (element.cantidad === undefined) {
        cantidad = 0.0;
      } else {
        cantidad = element.cantidad;
      }
      if (element.codigo === undefined) {
        codigo = "ND";
      } else {
        codigo = element.codigo;
      }
      if (element.tipoDte === undefined) {
        tipoDte = "ND";
      } else {
        tipoDte = element.tipoDte;
      }

      if (element.tipoDoc === undefined) {
        tipoDoc = 0;
      } else {
        tipoDoc = element.tipoDoc;
      }

      if (element.fechaEmision === undefined) {
        fechaEmision = "1980-01-01";
      } else {
        fechaEmision = element.fechaEmision;
      }
      if (element.montoSujetoGrav === undefined) {
        montoSujetoGrav = 0;
      } else {
        montoSujetoGrav = element.montoSujetoGrav;
      }
      if (element.codigoRetencionMH === undefined) {
        codigoRetencionMH = "ND";
      } else {
        codigoRetencionMH = element.codigoRetencionMH;
      }
      if (element.ivaRetenido === undefined) {
        ivaRetenido = 0.0;
      } else {
        ivaRetenido = element.ivaRetenido;
      }

      if (element.psv === undefined) {
        psv = 0.0;
      } else {
        psv = element.psv;
      }
      if (element.noGravado === undefined) {
        noGravado = 0.0;
      } else {
        noGravado = element.noGravado;
      }

      if (element.tipoItem === undefined) {
        tipoItem = 1;
      } else {
        tipoItem = element.tipoItem;
      }
      if (tipo == "07") {
        if (element.numDocumento === undefined) {
          numDocumento = "ND";
        } else {
          numeroDocumento = element.numDocumento;
        }
      } else {
        if (element.numeroDocumento === undefined) {
          numeroDocumento = "ND";
        } else {
          numeroDocumento = element.numeroDocumento;
        }
      }

      if (element.ventaNoSuj === undefined) {
        ventaNoSuj = 0;
      } else {
        ventaNoSuj = element.ventaNoSuj;
      }
      if (element.ventaExenta === undefined) {
        ventaExenta = 0;
      } else {
        ventaExenta = element.ventaExenta;
      }

      if (element.ventaGravada === undefined) {
        ventaGravada = 0;
      } else {
        ventaGravada = element.ventaGravada;
      }

      await sequelize.query(
        `insert into dte.dbo.cuerpoDocumento(dte_id,numItem,tipoItem,numeroDocumento,codigo,descripcion,cantidad,uniMedida,precioUni,montoDescu,ventaNoSuj,ventaExenta,ventaGravada,psv,noGravado,lote,tipoDte,tipoDoc,fechaEmision,montoSujetoGrav,codigoRetencionMH,ivaRetenido,compra) values (${id[0].Dte_id},${element.numItem},${tipoItem},'${numeroDocumento}','${codigo}','${element.descripcion}',${cantidad},'${uniMedida}',${precioUni},${montoDescu},${ventaNoSuj},${ventaExenta},${ventaGravada},${psv},${noGravado},'${lote}','${tipoDte}','${tipoDoc}','${fechaEmision}',${montoSujetoGrav},'${codigoRetencionMH}',${ivaRetenido},${compra})`,
        { type: QueryTypes.SELECT }
      );
      let _cuerpoDocId = 0;
      const cuerpoDocId = await sequelize.query(
        `select max(cuerpoDocumento_id) as id from dte.dbo.cuerpoDocumento where dte_id=${id[0].Dte_id}`
      );
      if (cuerpoDocId.length > 0) {
        _cuerpoDocId = cuerpoDocId[0][0].id;
      } else {
        _cuerpoDocId = 1;
      }

      //const _cuerpoDoc_id = cuerpoDocId[0][0].id;

      if (element.tributos !== undefined) {
        if (element.tributos !== null) {
          for (let yy = 0; yy < element.tributos.length; yy++) {
            const element2 = element.tributos[yy];
            await sequelize.query(
              `insert into dte.dbo.tributoCuerpoDocumento(dte_id,cuerpoDocumento_id,item) values(${id[0].Dte_id},${_cuerpoDocId},${element2})`,
              { type: QueryTypes.SELECT }
            );
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
};

const guardarResumen = async (_resumen, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    let totalNoGravado,
      totalPagar,
      saldoFavor,
      porcentajeDescuento,
      ivaPerci1,
      totalNoSuj,
      totalExenta,
      subTotalVentas,
      descuNoSuj,
      descuExenta,
      descuGravada,
      subTotal,
      ivaRete1,
      reteRenta,
      totalGravada,
      montoTotalOperacion,
      ventaGravada,
      condicionOperacion,
      totalDescu,
      totalSujetoRetencion,
      totalIVAretenido,
      totalLetras,
      totalCompra;
    if (_resumen.totalCompra === undefined) {
      totalCompra = 0.0;
    } else {
      totalCompra = _resumen.totalCompra;
    }

    if (_resumen.totalIVAretenidoLetras == undefined) {
      totalLetras = _resumen.totalLetras;
    } else {
      totalLetras = _resumen.totalIVAretenidoLetras;
    }
    if (_resumen.totalIVAretenido === undefined) {
      totalIVAretenido = 0;
    } else {
      totalIVAretenido = _resumen.totalIVAretenido;
    }
    if (_resumen.totalSujetoRetencion === undefined) {
      totalSujetoRetencion = 0;
    } else {
      totalSujetoRetencion = _resumen.totalSujetoRetencion;
    }
    if (_resumen.ventaGravada === undefined) {
      ventaGravada = 0;
    } else {
      ventaGravada = _resumen.ventaGravada;
    }
    if (_resumen.montoTotalOperacion === undefined) {
      montoTotalOperacion = 0;
    } else {
      montoTotalOperacion = _resumen.montoTotalOperacion;
    }

    if (_resumen.totalGravada === undefined) {
      totalGravada = 0;
    } else {
      totalGravada = _resumen.totalGravada;
    }
    if (_resumen.reteRenta === undefined) {
      reteRenta = 0;
    } else {
      reteRenta = _resumen.reteRenta;
    }
    if (_resumen.ivaRete1 === undefined) {
      ivaRete1 = 0;
    } else {
      ivaRete1 = _resumen.ivaRete1;
    }

    if (_resumen.descuNoSuj === undefined) {
      descuNoSuj = 0;
    } else {
      descuNoSuj = _resumen.descuNoSuj;
    }

    if (_resumen.subTotal === undefined) {
      subTotal = 0;
    } else {
      subTotal = _resumen.subTotal;
    }

    if (_resumen.descuGravada === undefined) {
      descuGravada = 0;
    } else {
      descuGravada = _resumen.descuGravada;
    }

    if (_resumen.descuExenta === undefined) {
      descuExenta = 0;
    } else {
      descuExenta = _resumen.totalNoSuj;
    }

    if (_resumen.totalNoSuj === undefined) {
      totalNoSuj = 0;
    } else {
      totalNoSuj = _resumen.totalNoSuj;
    }

    if (_resumen.totalExenta === undefined) {
      totalExenta = 0;
    } else {
      totalExenta = _resumen.totalExenta;
    }

    if (_resumen.totalNoGravado === undefined) {
      totalNoGravado = 0;
    } else {
      totalNoGravado = _resumen.totalNoGravado;
    }

    if (_resumen.subTotalVentas === undefined) {
      subTotalVentas = 0;
    } else {
      subTotalVentas = _resumen.subTotalVentas;
    }

    if (_resumen.descuNoSuj === undefined) {
      descuNoSuj = 0;
    } else {
      descuNoSuj = _resumen.descuNoSuj;
    }

    if (_resumen.totalPagar === undefined) {
      totalPagar = 0;
    } else {
      totalPagar = _resumen.totalPagar;
    }
    if (_resumen.saldoFavor === undefined) {
      saldoFavor = 0;
    } else {
      saldoFavor = _resumen.saldoFavor;
    }
    if (_resumen.porcentajeDescuento === undefined) {
      porcentajeDescuento = 0;
    } else {
      porcentajeDescuento = _resumen.porcentajeDescuento;
    }

    if (_resumen.ivaPerci1 === undefined) {
      ivaPerci1 = 0;
    } else {
      ivaPerci1 = _resumen.ivaPerci1;
    }

    if (_resumen.condicionOperacion === undefined) {
      condicionOperacion = 1;
    } else {
      condicionOperacion = _resumen.condicionOperacion;
    }
    if (_resumen.totalDescu === undefined) {
      totalDescu = 0;
    } else {
      totalDescu = _resumen.totalDescu;
    }

    await sequelize.query(
      `insert into dte.dbo.resumen(dte_Id,totalNoSuj,totalExenta,totalGravada,subTotalVentas,descuNoSuj,descuExenta,descuGravada,porcentajeDescuento,totalDescu,subTotal,ivaPerci1,ivaRete1,reteRenta,montoTotalOperacion,totalNoGravado,totalPagar,totalLetras,saldoFavor,condicionOperacion,totalSujetoRetencion,totalIVAretenido, totalCompra) values (${
        id[0].Dte_id
      },${totalNoSuj},${totalExenta},${totalGravada},${
        totalNoSuj + totalExenta + totalGravada
      },${descuNoSuj},${descuExenta},${descuGravada},${porcentajeDescuento},${totalDescu},${subTotal},${ivaPerci1},${ivaRete1},${reteRenta},${montoTotalOperacion},${totalNoGravado},${totalPagar},'${totalLetras}',${saldoFavor},${condicionOperacion},${totalSujetoRetencion},${totalIVAretenido},${totalCompra})`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};

const guardarTributoResumen = async (_tributos, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    if (_tributos !== null) {
      const cuerpoId = await sequelize.query(
        `select Max(resumen_id) as id from dte.dbo.resumen where dte_id=${id[0].Dte_id}`,
        { type: QueryTypes.SELECT }
      );

      const _cuerpoId = cuerpoId[0].id;
      //Insertamos en la tabla de tributoResumen
      for (let zz = 0; zz < _tributos.length; zz++) {
        const element3 = _tributos[zz];
        await sequelize.query(
          `insert into dte.dbo.tributoresumen(dte_Id,resumen_id,codigo,descripcion,valor) values (${id[0].Dte_id},${_cuerpoId},'${element3.codigo}','${element3.descripcion}',${element3.valor})`,
          { type: QueryTypes.SELECT }
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};
const guardarPagoResumen = async (_pagos, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    const cuerpoId = await sequelize.query(
      `select Max(resumen_id) as id from dte.dbo.resumen where dte_id=${id[0].Dte_id}`,
      { type: QueryTypes.SELECT }
    );
    const _cuerpoId = cuerpoId[0].id;
    for (let a = 0; a < _pagos.length; a++) {
      const element4 = _pagos[a];
      await sequelize.query(
        `insert into dte.dbo.pagosresumen(dte_Id,resumen_id,codigo,montoPago,plazo,referencia,periodo) values (${id[0].Dte_id},${_cuerpoId},'${element4.codigo}',${element4.montoPago},'${element4.plazo}','${element4.referencia}',${element4.periodo})`,
        { type: QueryTypes.SELECT }
      );
    }
  } catch (error) {
    console.log(error);
  }
};
const guardarRespuestaMH = async (_respuestaMH, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    const date = new Date(_respuestaMH.fhProcesamiento);
    const fecha = date;

    await sequelize.query(
      `insert into dte.dbo.respuestamh(dte_Id,version,ambiente,estado,codigoGeneracion,selloRecibido,fhprocesamiento, clasificaMsg,codigoMsg,descripcionMsg) values (${id[0].Dte_id},${_respuestaMH.version},'${_respuestaMH.ambiente}','${_respuestaMH.estado}','${_respuestaMH.codigoGeneracion}','${_respuestaMH.selloRecibido}',getDate(),'${_respuestaMH.clasificaMsg}','${_respuestaMH.codigoMsg}','${_respuestaMH.descripcionMsg}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};

const guardarApendice = async (factura, tipoSub,empresa) => {
  //Consultamos datos de la factura como vendedor,obervaciones

  try {
    const id = await dte(factura,empresa);
    const _empresa = await Sqlempresa(empresa)
    const fact = await SqlFactura(factura,_empresa[0].esquemaBD);
    let _vendedor,
      _nombre,
      _observaciones,
      _condiconPago,
      _descripcion,
      _cliente1,
      _pedido,
      _direccion,
      _tipo,
      _alias,
      _tem,
      _zona;
    if (fact.length > 0) {
      _vendedor = fact[0].VENDEDOR;
      _nombre = fact[0].NOMBRE;
      _observaciones = fact[0].observaciones;
      _condiconPago = fact[0].CONDICION_PAGO;
      _descripcion = fact[0].DESCRIPCION;
      _pedido = fact[0].PEDIDO;
      _cliente1 = fact[0].CLIENTE_ORIGEN;
      _alias = fact[0].ALIAS;
      _zona = fact[0].zona;
      const direEmbarque = await SqlDireEmbarque(
        fact[0].CLIENTE,
        fact[0].DIREC_EMBARQUE,
        _empresa[0].esquemaBD
      );
      _direccion = direEmbarque[0].DESCRIPCION.replace("DETALLE:", "");
      _tipo = fact[0].SUBTIPO_DOC_CXC;
    } else {
      const docCC = await SqlDocumentoCC(factura,_empresa[0].esquemaBD);
      _vendedor = docCC[0].VENDEDOR;
      _nombre = docCC[0].NOMBREVENDEDOR;
      _observaciones = "ND";
      _condiconPago = "ND";
      _descripcion = "ND";
      _pedido = "ND";
      _cliente1 = docCC[0].CLIENTE;
      _direccion = "ND";
      _tipo = 0;
    }
    const clie = await SqlCliente(_cliente1,_empresa[0].esquemaBD);
    let _noClie = clie[0].NOMBRE;
    const _cliente = _cliente1 + "-" + _noClie;
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'VENDEDOR','VENDEDOR','${_vendedor}')`,
      { type: QueryTypes.SELECT }
    );
    let newNombre = _nombre.replace(/["']/g, "");
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'NOMBRE','NOMBRE','${newNombre}')`,
      { type: QueryTypes.SELECT }
    );
    if (tipoSub == 47) {
      await sequelize.query(
        `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'OBSERVACIONES','OBSERVACIONES','ND')`,
        { type: QueryTypes.SELECT }
      );
    } else {
      await sequelize.query(
        `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'OBSERVACIONES','OBSERVACIONES','${_observaciones}')`,
        { type: QueryTypes.SELECT }
      );
    }

    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'PAGO','PAGO','${_condiconPago}')`,
      { type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'DESCRIPCION','DESCRIPCION','${_descripcion}')`,
      { type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'CLIENTE','CLIENTE','${_cliente}')`,
      { type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'ALIAS','ALIAS','${_alias}')`,
      { type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'PEDIDO','PEDIDO','${_pedido}')`,
      { type: QueryTypes.SELECT }
    );

    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'DIRECION','DIRECION','${_direccion}')`,
      { type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `insert into dte.dbo.apendice(dte_id,campo,etiqueta,valor) values(${id[0].Dte_id},'ZONA','ZONA','${_zona}')`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};
const updateDte = async (_respuestaMH, factura,empresa) => {
  try {
    const id = await dte(factura,empresa);

    await sequelize.query(
      `update dte.dbo.dtes set estado='${_respuestaMH.estado}',selloRecibido='${_respuestaMH.selloRecibido}',updateDate=getDate() where Dte_id=${id[0].Dte_id}`,
      { type: QueryTypes.SELECT }
    );
  } catch (error) {
    console.log(error);
  }
};
const updateFacturaDte = async (_factura,empresa) => {
  try {
    
    const _dte = await dte(_factura,empresa[0].Empresa_id);
    await sequelize.query(
      `EXEC DTE.dbo.dte_updateFactura '${_factura}','${_dte[0].codigoGeneracion}','${empresa[0].esquemaBD}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
  } catch (error) {
    console.log(error);
  }
};
const guardarObservacionesMH = async (datos, factura,empresa) => {
  const id = await dte(factura,empresa);
  try {
    const respuestaMhId = await sequelize.query(
      `select Max(respuestamh_id) as id from dte.dbo.respuestamh where dte_id=${id[0].Dte_id}`,
      { type: QueryTypes.SELECT }
    );
    let _respuestaMHId = 0;
    if (respuestaMhId.length > 0) {
      _respuestaMHId = respuestaMhId[0].id;
    } else {
      _respuestaMHId = 0;
    }

    for (let d = 0; d < datos.length; d++) {
      const el = datos[d];
  
      await sequelize.query(
        `insert into dte.dbo.observaciones(dte_id,respuestamh_id,descripcion) values (${id[0].Dte_id},${_respuestaMHId},'${el}')`,
        { type: QueryTypes.SELECT }
      );
    }
  } catch (error) {}
};
const dte = async (doc,empresa) => {
  return (dte_id = await SqlDte(doc,empresa));
};
module.exports = {
  guardarDte,
  guardarDocumentoRelacionas,
  guardarIdentificacion,
  guardarEmision,
  guardarReceptor,
  guardarventaTercero,
  guardarcueroDocumento,
  guardarResumen,
  guardarRespuestaMH,
  guardarObservacionesMH,
  guardarTributoResumen,
  guardarPagoResumen,
  updateDte,
  guardarSubjectoExcluido,
  guardarApendice,
  updateFacturaDte,
};
