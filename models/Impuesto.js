const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Impuesto = sequelize.define(
  "IMPUESTO",
  {
    IMPUESTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Impuesto;
