//
// Cargas (web) entre el ERP y las handhelds. Solo ejecutan procedimientos almacenados.
//
// Procedimientos (COAGRO2.erpadmin):
//   - CargaAlERP @COD_CIA -> pasa al ERP lo que bajaron las handhelds para la compania
//   - CargaAlMovil        -> prepara los datos que van a bajar las handhelds (sin parametros)

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");

// POST /fr/carga/erp  body: { COD_CIA }
const cargaAlErp = async (req, res) => {
  try {
    const { COD_CIA } = req.body;
    if (!COD_CIA) {
      return res.send({ result: {}, success: false, errors: ["El campo COD_CIA es requerido"] });
    }

    const result = await sequelize.query(
      `EXEC COAGRO2.erpadmin.CargaAlERP :codCia`,
      { replacements: { codCia: COD_CIA }, type: QueryTypes.SELECT }
    );

    res.send({ result, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al ejecutar la carga al ERP"],
    });
  }
};

// POST /fr/carga/movil
const cargaAlMovil = async (req, res) => {
  try {
    const result = await sequelize.query(`EXEC COAGRO2.erpadmin.CargaAlMovil`, {
      type: QueryTypes.SELECT,
    });

    res.send({ result, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al ejecutar la carga al movil"],
    });
  }
};

module.exports = { cargaAlErp, cargaAlMovil };
