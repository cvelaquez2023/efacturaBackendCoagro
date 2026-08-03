const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { NCFconsecutivoModel } = require("../models");

const getNCFconsecutivo = async (req, res) => {
  try {
    const data = await NCFconsecutivoModel.findAll({
      where: { TIPO: "FA", ACTIVO: "S" },
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getNCFconsecutivo };
