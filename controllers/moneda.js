const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { monedaModel } = require("../models");

const getMoneda = async (req, res) => {
  const _subTipo = req.params.id;
  try {
    const data = await monedaModel.findAll({
      raw: true,
      subQuery: false,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getMoneda };
