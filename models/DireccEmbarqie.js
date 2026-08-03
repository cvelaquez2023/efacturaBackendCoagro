const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const DireccEmbarque = sequelize.define(
  "DIRECC_EMBARQUE",
  {
    CLIENTE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DIRECCION: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DETALLE_DIRECCION: {
      type: DataTypes.INTEGER,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    CONCTATO: {
      type: DataTypes.STRING,
    },
    CARGO: {
      type: DataTypes.STRING,
    },
    TELEFONO: {
      type: DataTypes.STRING,
    },
    FAX: {
      type: DataTypes.STRING,
    },
    EMAIL: {
      type: DataTypes.NUMBER,
    },
  },
  { timestamps: false }
);

module.exports = DireccEmbarque;
