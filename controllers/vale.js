const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { cajaChicaModel, valeModel } = require("../models");
const { parse } = require("dotenv");

const postVale = async (req, res) => {
  const {
    ADMIN_CREACION,
    ADMIN_MODIFIC,
    BENEFICIARIO,
    CAJA_CHICA,
    CONCEPTO_VALE,
    DEPARTAMENTO,
    DESTINO_ITBIS,
    ESTADO,
    FACTURA_ELECTRONICA,
    FECHA_CREACION,
    FECHA_EMISION,
    FECHA_MODIFIC,
    MONTO_CAJA,
    MONTO_DOLAR,
    MONTO_EFECTIVO,
    MONTO_LOCAL,
    MONTO_VALE,
    REINTEGRO,
    SUBTOTAL_BIENES,
    SUBTOTAL_SERVICIOS,
    TIPO_CAMB_CAJA,
    TIPO_CAMB_DOLAR,
    TIPO_CF,
    USUARIO_CREACION,
    USUARIO_MODIFIC,
    SALDO_CAJA,
  } = req.body;

  try {
    //consultamos el correlativi de caja chica

    const _consecutivo = await cajaChicaModel.findAll({
      attributes: ["ULTIMO_CONSECUTIVO"],
      where: { CAJA_CHICA: CAJA_CHICA },
      raw: true,
    });

    const _ultimoConsecutivo = parseInt(_consecutivo[0].ULTIMO_CONSECUTIVO) + 1;
    const _conseVale = await valeModel.max("CONSECUTIVO");

    datos = {
      USUARIO_CREACION: USUARIO_CREACION,
      USUARIO_MODIFIC: USUARIO_MODIFIC,
      VALE: _ultimoConsecutivo,
      CONSECUTIVO: _conseVale + 1,
      ADMIN_CREACION: ADMIN_CREACION,
      ADMIN_MODIFIC: ADMIN_MODIFIC,
      BENEFICIARIO: BENEFICIARIO,
      CAJA_CHICA: CAJA_CHICA,
      CONCEPTO_VALE: CONCEPTO_VALE,
      DEPARTAMENTO: DEPARTAMENTO,
      DESTINO_ITBIS: DESTINO_ITBIS,
      ESTADO: ESTADO,
      FACTURA_ELECTRONICA: FACTURA_ELECTRONICA,
      FECHA_CREACION: FECHA_CREACION,
      FECHA_LIQUIDACION: FECHA_CREACION,
      FECHA_EMISION: FECHA_EMISION,
      FECHA_MODIFIC: FECHA_MODIFIC,
      MONTO_CAJA: MONTO_CAJA,
      MONTO_DOLAR: MONTO_DOLAR,
      MONTO_EFECTIVO: MONTO_EFECTIVO,
      MONTO_LOCAL: MONTO_LOCAL,
      MONTO_VALE: MONTO_VALE,
      REINTEGRO: REINTEGRO,
      SUBTOTAL_BIENES: SUBTOTAL_BIENES,
      SUBTOTAL_SERVICIOS: SUBTOTAL_SERVICIOS,
      TIPO_CAMB_CAJA: TIPO_CAMB_CAJA,
      TIPO_CAMB_DOLAR: TIPO_CAMB_DOLAR,
      TIPO_CF: TIPO_CF,
    };

    //insertamos en la tabla de vales
    const CreateVale = await valeModel.create(datos);

    const _cajaChica = CAJA_CHICA;
    const _saldoCaja = parseFloat(SALDO_CAJA) - parseFloat(MONTO_VALE);

    const isExito = CreateVale._options.isNewRecord;
    if (isExito) {
      // si fue existosa actualizamo el saldo de la caja y el correlativo del vale

      const saldoCaja = await cajaChicaModel.update(
        {
          SALDO: _saldoCaja,
          ULTIMO_CONSECUTIVO: _ultimoConsecutivo,
        },
        { where: { CAJA_CHICA: _cajaChica } }
      );
      datosRes = {
        conse: _conseVale + 1,
        vale: _ultimoConsecutivo,
      };
      res.send({ result: [datosRes], success: true });
    } else {
      res.send({
        result: {},
        success: false,
        errors: "No se pudo guardar el Vale",
      });
    }
  } catch (error) {
    console.log(error);
  }
};
const getVale = async (req, res) => {
  try {
    const _cajaChica = req.params.cajachica;
    const vales = await valeModel.findAll({
      where: { CAJA_CHICA: _cajaChica, ESTADO: "P" },
    });
    res.send({ result: vales, success: true });
  } catch (error) {
    res.send({ result: {}, success: false, errors: error });
  }
};

module.exports = { postVale, getVale };
