const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Diario = sequelize.define(
  "DIARIO",
  {
    ASIENTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    CONSECUTIVO: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    NIT: {
      type: DataTypes.STRING,
    },
    CENTRO_COSTO: {
      type: DataTypes.STRING,
    },
    CUENTA_CONTABLE: {
      type: DataTypes.STRING,
    },
    FUENTE: {
      type: DataTypes.STRING,
    },
    REFERENCIA: {
      type: DataTypes.STRING,
    },
    DEBITO_LOCAL: {
      type: DataTypes.DECIMAL,
    },
    DEBITO_DOLAR: {
      type: DataTypes.DECIMAL,
    },
    CREDITO_LOCAL: {
      type: DataTypes.DECIMAL,
    },
    CREDITO_DOLAR: {
      type: DataTypes.DECIMAL,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Diario;
