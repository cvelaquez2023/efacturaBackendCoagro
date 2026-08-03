const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { detalleDireccionModel } = require("../models");

const getDireccion = async (req, res) => {
  try {
    const cliente = req.cliente;

    console.log(cliente);
    res.send({ results: "data", result: true, total: 1 });
  } catch (error) {
    res.send({ results: "error", result: false, message: error });
  }
};

const postDireccion = async (req, res) => {
  try {
    const pais = req.body.pais;
    const departamento = req.body.departamento;
    const municipio = req.body.municipio;
    const calle = req.body.calle;
    const direccion = req.body.direccion;
    const destinatario = req.body.destinatario;
    const direEnvio = req.body.direEnvio;
    const standar = "ESTANDAR";
    const cliente = req.cliente;
    console.log(direEnvio);
    const ultimo = await sequelize.query(
      "select max(DETALLE_DIRECCION) as ultimo from bellmart.DETALLE_DIRECCION",
      { type: QueryTypes.SELECT }
    );
    const _ultimo = ultimo[0].ultimo + 1;

    const insertDetalleDireccion = await detalleDireccionModel.query(
      "INSERT INTO [bellmart].[DETALLE_DIRECCION] ([DETALLE_DIRECCION],[DIRECCION],[CAMPO_1],[CAMPO_2],[CAMPO_3],[CAMPO_4],[CAMPO_5],[CAMPO_6]) VALUES ( (:_1),(:_2),(:_3),(:_4),(:_5),(:_6),(:_7),(:_8))",
      {
        replacemenst: {
          _1: _ultimo,
          _2: standar,
          _3: direccion,
          _4: pais,
          _5: departamento,
          _6: municipio,
          _7: calle,
          _8: destinatario,
        },
      },
      { type: QueryTypes.INSERT }
    );
    console.log("se inserto", insertDetalleDireccion);
    res.send({ results: "data", result: true, total: 1 });
  } catch (error) {
    res.send({ results: "error", result: false, message: error });
  }
};
const putDireccion = async (req, res) => {
  try {
    const cliente = req.cliente;
    console.log(cliente);
    res.send({ results: "data", result: true, total: 1 });
  } catch (error) {
    res.send({ results: "error", result: false, message: error });
  }
};

module.exports = {
  getDireccion,
  postDireccion,
  putDireccion,
};
