const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const { cuentaConatbleModel } = require("../models");

const getCuentaContable = async (req, res) => {
  try {
    const data = await cuentaConatbleModel.findAll({
      where: { ACEPTA_DATOS: "S" },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getCuentaContable };
