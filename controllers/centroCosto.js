const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");


const { centroCostoModel } = require("../models");

const getCentroCosto = async (req, res) => {
  try {
    const data = await centroCostoModel.findAll({
      where: { ACEPTA_DATOS: "S" },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getCentroCosto };
