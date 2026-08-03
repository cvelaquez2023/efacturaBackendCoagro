const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { impuestoModel } = require("../models");
const { Sqlempresa } = require("../sqltx/sql");

const getImpuesto = async (req, res) => {

  const User = req.cliente;

  const empresa = await Sqlempresa(User[0].empresa)
  

  try {
    const _data = await sequelize.query(
      `EXEC dte.dbo.SP__impuestos '${empresa[0].esquemaBD}' `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getImpuesto };