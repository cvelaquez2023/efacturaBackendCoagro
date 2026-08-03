const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Moneda = sequelize.define(
  "MONEDA",
  {
    MONEDA: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    NOMBRE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Moneda;
