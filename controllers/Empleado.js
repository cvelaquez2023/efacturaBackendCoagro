const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { empleadoModel, responsable } = require("../models");
const { get } = require("https");

const getEmpleado = async (req, res) => {
  try {
    const data = await empleadoModel.findAll({
      where: { ACTIVO: "S" },
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};
const getResponsable = async (req, res) => {
  try {
    const data = await responsable.findAll({
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getEmpleado, getResponsable };
