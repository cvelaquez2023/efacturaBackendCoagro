const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const DetalleDirecion = sequelize.define(
  "DETALLE_DIRECCION",
  {
    DETALLE_DIRECCION: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DIRECCION: {
      type: DataTypes.STRING,
    },
    CAMPO_1: {
      type: DataTypes.STRING,
    },
    CAMPO_2: {
      type: DataTypes.STRING,
    },
    CAMPO_3: {
      type: DataTypes.STRING,
    },
    CAMPO_4: {
      type: DataTypes.STRING,
    },
    CAMPO_5: {
      type: DataTypes.STRING,
    },
    CAMPO_6: {
      type: DataTypes.STRING,
    },
    CAMPO_7: {
      type: DataTypes.STRING,
    },
    CAMPO_8: {
      type: DataTypes.STRING,
    },
    CAMPO_9: {
      type: DataTypes.STRING,
    },
    CAMPO_10: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false }
);

module.exports = DetalleDirecion;
