const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const { docSoporteModel, valeModel } = require("../models");
const { parse } = require("dotenv");
const { SqlDte } = require("../sqltx/sql");

const postdocsSoporte14 = async (req, res) => {
  const {
    _vale,
    _linea,
    _centro_costo,
    _cuenta_contable,
    _nit,
    _doc_soporte,
    _tipo,
    _monto,
    _monot_vale,
    _concepto,
    _detalle,
    _subtotal,
    _impuesto1,
    _impuesto2,
    _rubro1,
    _rubro2,
    _descuento,
    _subtipo,
    _fecha,
    _fecha_rigue,
    _codigo_impuesto,
    _base_impuesto1,
    _base_impuesto2,
    _id,
    _montoProvisional,
    _montoDefinitivo,
    _procesaMH,
  } = req.body;

  
  try {
    //consultamos si hay registris en el vale para ver la liena
    let nuevaLiena = 0;
    const LineaVale = await docSoporteModel.findAll({
      where: { VALE: _vale },
      attributes: [[sequelize.fn("max", sequelize.col("LINEA")), "max"]],
      raw: true,
    });

    if (LineaVale[0].max === 0) {
      nuevaLiena = LineaVale[0].max + 1;
    } else if (LineaVale[0].max > 0) {
      nuevaLiena = LineaVale[0].max + 1;
    } else {
      nuevaLiena = 0;
    }
    const doc = _doc_soporte.substr(0, 34);

    const dte = await SqlDte(doc);
    const codgen = dte[0].codigoGeneracion;
    const dato = {
      VALE: _vale,
      LINEA: nuevaLiena,
      CENTRO_COSTO: _centro_costo,
      CUENTA_CONTABLE: _cuenta_contable,
      NIT: _nit,
      DOC_SOPORTE: _doc_soporte,
      TIPO: _tipo,
      MONTO: _monto,
      MONTO_VALE: _monto,
      CONCEPTO: _concepto,
      DETALLE: _detalle,
      SUBTOTAL: _subtotal,
      IMPUESTO1: _impuesto1,
      IMPUESTO2: _impuesto2,
      RUBRO1: _rubro1,
      RUBRO2: _rubro2,
      DESCUENTO: _descuento,
      SUBTIPO: _subtipo,
      FECHA: _fecha,
      FECHA_RIGE: _fecha_rigue,
      CODIGO_IMPUESTO: _codigo_impuesto,
      BASE_IMPUESTO1: _base_impuesto1,
      BASE_IMPUESTO2: _base_impuesto2,
      IMP1_AFECTA_COSTO: "N",
      IMP1_ASUMIDO_DESC: 0.0,
      IMP1_ASUMIDO_NODESC: 0.0,
      SUBTOTALES_BIENES: 0.0,
      SUBTOTALES_SERVICIOS: 0.0,
      CLASE_DOC_ES: 4,
      DOCUMENTO_FISCAL: codgen,
    };
    const guardar = await docSoporteModel.create(dato);
    //actualizamos el saldo de vale

    const saldoCaja =
      parseFloat(_montoDefinitivo).toFixed(2) + parseFloat(_monto).toFixed(2);
    const actt = await valeModel.update(
      { MONTO_VALE: saldoCaja },
      { where: { CONSECUTIVO: _vale } }
    );

    //actualizamos la tabla dte para cambiar la bandera de dte en procesado

    await sequelize.query(
      `UPDATE DTE.dbo.DTES set procesado=1,mudulo='CH' WHERE Dte_id='${_id}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    res.send({ result: guardar, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: error });
  }
};

module.exports = { postdocsSoporte14 };
