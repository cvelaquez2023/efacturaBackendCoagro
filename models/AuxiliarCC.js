const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const AuxiliarCC = sequelize.define(
  "AUXILIAR_CC",
  {
    DEBITO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    CREDITO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = AuxiliarCC;
