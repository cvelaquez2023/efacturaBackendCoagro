const { sequelize } = require("../config/mssql");
const { Sqlempresa } = require("../sqltx/sql");

const getAnulados = async (req, res) => {
  try {
    const _ano = req.params.ano;
    const _mes = req.params.mes;
    const cliente = req.cliente;


    const empresa = await Sqlempresa(cliente[0].empresa);
    const _data = await sequelize.query(
      `EXEC DTE.dbo.dte_docsInvalidacion  ${_ano},${_mes},${empresa[0].esquemaBD} `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = getAnulados;
