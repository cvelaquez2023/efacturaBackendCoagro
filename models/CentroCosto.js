const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const CentroCosto = sequelize.define(
  "CENTRO_COSTO",
  {
    CENTRO_COSTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    ACEPTA_DATOS: {
      type: DataTypes.STRING,
    },
    TIPO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = CentroCosto;
