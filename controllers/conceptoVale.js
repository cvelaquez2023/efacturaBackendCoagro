const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { conceptoValeModel } = require("../models");

const getConceptoVale = async (req, res) => {
  try {
    const data = await conceptoValeModel.findAll({
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getConceptoVale };
