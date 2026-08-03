const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Consecutivo = sequelize.define(
  "CONSECUTIVO",
  {
    Consecutivo: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    Descripcion: {
      type: DataTypes.STRING,
    },
    Activo: {
      type: DataTypes.STRING,
    },
    Entidad: {
      type: DataTypes.STRING,
    },
    Documento: {
      type: DataTypes.STRING,
    },
    ultimo_valor: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false }
);

module.exports = Consecutivo;
