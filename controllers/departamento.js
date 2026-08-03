const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { departamentoModel } = require("../models");

const getDepartamento = async (req, res) => {
  try {
    const data = await departamentoModel.findAll({
      where: { ACTIVO: "S" },
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getDepartamento };
