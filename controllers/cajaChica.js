const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { cajaChicaModel } = require("../models");

const getCajaChica = async (req, res) => {
  try {
    const data = await cajaChicaModel.findAll({
      where: { ESTADO: "A" },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getCajaChica };
