const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { condicionPagoModel } = require("../models");

const getCondPago = async (req, res) => {
  try {
    const data = await condicionPagoModel.findAll({
      raw: true,
      subQuery: false,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getCondPago };
