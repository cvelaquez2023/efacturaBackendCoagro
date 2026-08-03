const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const NCFconsecutivo = sequelize.define(
  "NCF_CONSECUTIVO",
  {
    PREFIJO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },

    ACTIVO: {
      type: DataTypes.STRING,
    },
    ACTIVO: {
      type: DataTypes.STRING,
    },
    TIPO: {
      type: DataTypes.STRING,
    },
    TIPO_CONTRIBUYENTE: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = NCFconsecutivo;
