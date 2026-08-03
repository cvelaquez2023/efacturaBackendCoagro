const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const getBuscar = async (req, res) => {
  try {
    const key = req.params.key;
    const bodega = req.query.bodega;
    const nivelPrecio = req.query.nivelPrecio;
    //cla P=producto M= marcar C= categoria,S=subcategoria T= tipo
    const cla = "P";
    const data = await sequelize.query(
      `EXEC bellmart.apibuscar '${key}','${nivelPrecio}','${bodega}','P'`,

      { type: QueryTypes.SELECT }
    );

    const data2 = await sequelize.query(
      `EXEC bellmart.apibuscar '${key}','${nivelPrecio}','${bodega}','M'`,

      { type: QueryTypes.SELECT }
    );
    const data3 = await sequelize.query(
      `EXEC bellmart.apibuscar '${key}','${nivelPrecio}','${bodega}','C'`,

      { type: QueryTypes.SELECT }
    );
    const data4 = await sequelize.query(
      `EXEC bellmart.apibuscar '${key}','${nivelPrecio}','${bodega}','S'`,

      { type: QueryTypes.SELECT }
    );
    const data5 = await sequelize.query(
      `EXEC bellmart.apibuscar '${key}','${nivelPrecio}','${bodega}','T'`,

      { type: QueryTypes.SELECT }
    );
    if (data.length > 0) {
      res.send({ results: data, result: "true" });
    } else if (data2.length > 0) {
      res.send({ results: data2, result: "true" });
    } else if (data3.length > 0) {
      res.send({ results: data3, result: "true" });
    } else if (data4.length > 0) {
      res.send({ results: data4, result: "true" });
    } else if (data5.length > 0) {
      res.send({ results: data5, result: "true" });
    } else {
      res.send({ results: [{}], result: "true" });
    }
  } catch (error) {}
};
module.exports = { getBuscar };
