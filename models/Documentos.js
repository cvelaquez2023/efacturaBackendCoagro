const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const Documentos = sequelize.define(
  "DOCUMENTOS_CC",
  {
    DOCUMENTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    TIPO: {
      type: DataTypes.STRING,
    },
    FECHA_DOCUMENTO: {
      type: DataTypes.STRING,
    },
    MONTO: {
      type: DataTypes.DECIMAL,
    },
    CLIENTE: {
      type: DataTypes.STRING,
    },
    APLICACION: {
      type: DataTypes.STRING,
    },
    CARGADO_DE_FACT: {
      type: DataTypes.STRING,
    },
    SUBTIPO: {
      type: DataTypes.INTEGER,
    },
    CreateDate: {
      type: DataTypes.STRING,
    },
    IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    BASE_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Documentos;
