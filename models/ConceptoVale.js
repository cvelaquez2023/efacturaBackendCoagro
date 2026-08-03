const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const conceptoVale = sequelize.define(
  "CONCEPTO_VALE",
  {
    CONCEPTO_VALE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    CENTRO_COSTO: {
      type: DataTypes.STRING,
    },
    CUENTA_CONTABLE: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = conceptoVale;
