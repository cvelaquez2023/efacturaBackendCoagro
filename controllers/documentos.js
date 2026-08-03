const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { documentoModel, facturaModel } = require("../models");
const { handleHttpError } = require("../utils/handleError");

const getDocumentos = async (req, res) => {
  try {
    const user = req.cliente;

    const data = await sequelize.query(
      "select cc.DOCUMENTO,cc.TIPO,cc.FECHA_DOCUMENTO,cc.MONTO,cc.APLICACION,fa.COMENTARIO_CXC from bellmart.DOCUMENTOS_CC cc ,bellmart.FACTURA fa where cc.CLIENTE=(:clie) and cc.DOCUMENTO=fa.FACTURA and fa.TIPO_DOCUMENTO='F' union select DOCUMENTO,TIPO,FECHA_DOCUMENTO,MONTO,APLICACION,'ND' AS COMENTARIO_CXC from bellmart.DOCUMENTOS_CC where CLIENTE=(:clie) and TIPO='REC'",
      {
        replacements: { clie: user.CLIENTE },
      },
      { type: QueryTypes.SELECT }
    );
    dataNew = JSON.stringify(data[0]);
    dataNew = JSON.parse(dataNew);

    res.send({ results: dataNew, result: "true" });
  } catch (error) {
    console.log(error);
  }
};

const putDocumento = async (req, res) => {
  try {
    const user = req.cliente;
    const fact = req.params.fac;

    //Realizamos la actualziacion en la tabla de factura

    const UpdateFactura = await facturaModel.update(
      { COMENTARIO_CXC: req.body.Guia },
      { where: { FACTURA: fact } }
    );

    res.send({ UpdateFactura });
  } catch (error) {
    console.log(error);
    handleHttpError(res, "ERROR_PUTDCOCUMENTOS");
  }
};
module.exports = { getDocumentos, putDocumento };
