const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Nit = sequelize.define(
  "NIT",
  {
    NIT: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    RAZON_SOCIAL: {
      type: DataTypes.STRING,
    },
    ALIAS: {
      type: DataTypes.STRING,
    },
    TIPO: {
      type: DataTypes.STRING,
    },
    ORIGEN: {
      type: DataTypes.STRING,
    },
    ACTIVO: {
      type: DataTypes.STRING,
    },
    TIPO_CONTRIBUYENTE: {
      type: DataTypes.STRING,
    },
    NRC: {
      type: DataTypes.STRING,
    },
    GIRO: {
      type: DataTypes.STRING,
    },
    CATEGORIA: {
      type: DataTypes.STRING,
    },
    TIPO_REGIMEN: {
      type: DataTypes.STRING,
    },
    INF_LEGAL: {
      type: DataTypes.STRING,
    },
    DETALLAR_KITS: {
      type: DataTypes.STRING,
    },
    ACEPTA_DOC_ELECTRONICO: {
      type: DataTypes.STRING,
    },
    USA_REPORTE_D151: {
      type: DataTypes.STRING,
    },
    NUMERO_DOC_NIT: {
      type: DataTypes.STRING,
    },
    EXTERIOR: {
      type: DataTypes.INTEGER,
    },
    NATURALEZA: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Nit;
