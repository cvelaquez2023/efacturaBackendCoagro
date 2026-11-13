const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const EfectividadVisita = sequelize.define(
  "EFECT_VISITA_RT",
  {
    EFECT_VISITA: {
      type: DataTypes.STRING(2),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: { args: [1, 2], msg: "El codigo de la razon admite un maximo de 2 caracteres" },
      },
    },
    // varchar(60) en BD despues del ALTER de docs/pendientes-fr-promociones.sql
    // (antes era varchar(20)). Hasta correr el ALTER, mas de 20 da error de truncado.
    DESCRIPCION: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: {
        len: { args: [1, 60], msg: "La descripcion admite un maximo de 60 caracteres" },
      },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = EfectividadVisita;
