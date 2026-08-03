const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { empleadoModel, NCFsecuenciaModel } = require("../models");

const getNCFsecuencia = async (req, res) => {
  try {
    console.log(req);
    const _prefijo = req.params.prefijo;
    const data = await NCFsecuenciaModel.findAll({
      where: { PREFIJO: _prefijo },
      raw: true,
      subQuery: false,
    });

    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getNCFsecuencia };
