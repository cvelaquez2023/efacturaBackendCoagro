const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const getCentroCuenta = async (req, res) => {
  try {
    const _centroCosto = req.params.id;
    const _data = await sequelize.query(
      `EXEC dte.dbo.dte_centroCuenta'${_centroCosto}','1' `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

const getCentroCuenta2 = async (req, res) => {
  try {
    const _centroCosto = req.params.id;
    const _data = await sequelize.query(
      `EXEC dte.dbo.dte_centroCuenta'${_centroCosto}','2' `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getCentroCuenta, getCentroCuenta2 };
