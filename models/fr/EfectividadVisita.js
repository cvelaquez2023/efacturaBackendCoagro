const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const EfectividadVisita = sequelize.define(
  "EFECT_VISITA_RT",
  {
    EFECT_VISITA: {
      type: DataTypes.STRING(2),
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = EfectividadVisita;
