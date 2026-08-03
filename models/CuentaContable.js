const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const CuentaContable = sequelize.define(
  "CUENTA_CONTABLE",
  {
    CUENTA_CONTABLE: {
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

module.exports = CuentaContable;
