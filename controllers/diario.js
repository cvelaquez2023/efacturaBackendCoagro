const { QueryTypes, where } = require("sequelize");
const { sequelize } = require("../config/mssql");

const { diarioModel, asientoDiarioModel } = require("../models");
const { max } = require("moment/moment");
const Consecutivo = require("../models/Consecutivo");

const getDiario = async (req, res) => {
  const _asiento = req.params.asiento;
  try {
    const _data = await sequelize.query(
      `EXEC dte.dbo.dte_asiento'${_asiento}' `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};
const postDiario = async (req, res) => {
  const _asiento = req.body.asiento;
  const _consecutivo = req.body.consecutivo;
  const _centrocosto = req.body.centroCosto;
  const _cuentacontable = req.body.cuentaContable;
  const _fuente = req.body.fuente;
  const _referencia = req.body.referencia;
  const _debito_local = req.body.debito;
  const _creditoLocal = req.body.credito;

  try {
    const updateAsiento = await diarioModel.update(
      {
        CENTRO_COSTO: _centrocosto,
        CUENTA_CONTABLE: _cuentacontable,
        FUENTE: _fuente,
        REFERENCIA: _referencia,
        DEBITO_LOCAL: _debito_local,
        CREDITO_LOCAL: _creditoLocal,
      },
      { where: { ASIENTO: _asiento, CONSECUTIVO: _consecutivo } }
    );
    //actualizamos el asiento de diario encabezado.
    //ACTUALIZMOS LOS SALDOS DE ASIEENTO DE DIARIO

    const _totalDebito = await diarioModel.findAll({
      attributes: [[sequelize.fn("SUM", sequelize.col("DEBITO_LOCAL")), "SUM"]],
      where: {
        ASIENTO: _asiento,
      },
      raw: true,
    });
    const _totalCredito = await diarioModel.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("CREDITO_LOCAL")), "SUM"],
      ],
      where: {
        ASIENTO: _asiento,
      },
      raw: true,
    });

    const _updateAsientoDiario = await asientoDiarioModel.update(
      {
        TOTAL_DEBITO_LOC: _totalDebito[0].SUM,
        TOTAL_CREDITO_LOC: _totalCredito[0].SUM,
      },
      {
        where: { ASIENTO: _asiento },
      }
    );

    res.send({ result: updateAsiento, success: true });
  } catch (error) {
    console.log(error);
  }
};
const deleteDiario = async (req, res) => {
  const _asiento = req.params.asiento;
  const _consecutivo = req.params.cons;

  try {
    const updateAsiento = await diarioModel.destroy({
      where: { ASIENTO: _asiento, CONSECUTIVO: _consecutivo },
    });
    //actualizamos el asiento de diario encabezado.

    res.send({ result: updateAsiento, success: true });
  } catch (error) {
    console.log(error);
  }
};

const postAsientoLinea = async (req, res) => {
  try {
    const _asiento = req.body.asiento;
    const _fuente = req.body.fuente;
    const _referencia = req.body.referencia;
    const _centroCosto = req.body.centroCosto;
    const _cuentaContable = req.body.cuentaContable;
    const _debito = req.body.debito;
    const _credito = req.body.credito;

    //consultamos el numero max de consecutivo que se ha registrado en el asiento
    const maxConse = await diarioModel.findAll({
      attributes: [[sequelize.fn("MAX", sequelize.col("CONSECUTIVO")), "MAX"]],
      where: {
        ASIENTO: _asiento,
      },
      raw: true,
    });

    let newConsecutivo = maxConse[0].MAX + 1;
    //guardamos la linea en diario

    const diario = await diarioModel.create({
      ASIENTO: _asiento,
      CONSECUTIVO: newConsecutivo,
      NIT: "ND",
      CENTRO_COSTO: _centroCosto,
      CUENTA_CONTABLE: _cuentaContable,
      FUENTE: _fuente,
      REFERENCIA: _referencia,
      DEBITO_LOCAL: _debito,
      DEBITO_DOLAR: _debito,
      CREDITO_LOCAL: _credito,
      CREDITO_DOLAR: _credito,
    });
    //ACTUALIZMOS LOS SALDOS DE ASIEENTO DE DIARIO

    const _totalDebito = await diarioModel.findAll({
      attributes: [[sequelize.fn("SUM", sequelize.col("DEBITO_LOCAL")), "SUM"]],
      where: {
        ASIENTO: _asiento,
      },
      raw: true,
    });
    const _totalCredito = await diarioModel.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("CREDITO_LOCAL")), "SUM"],
      ],
      where: {
        ASIENTO: _asiento,
      },
      raw: true,
    });

    const _updateAsientoDiario = await asientoDiarioModel.update(
      {
        TOTAL_DEBITO_LOC: _totalDebito[0].SUM,
        TOTAL_CREDITO_LOC: _totalCredito[0].SUM,
      },
      {
        where: { ASIENTO: _asiento },
      }
    );

    res.send({ result: diario, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getDiario, postDiario, deleteDiario, postAsientoLinea };
