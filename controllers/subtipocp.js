const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const SubTipoDocCp = require("../models/SubTipoDocCp");

const getSubTipoCp = async (req, res) => {
  const _subTipo = req.params.id;
  try {
    const data = await SubTipoDocCp.findAll({
      where: { cat002: _subTipo },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getSubTipoCp };
