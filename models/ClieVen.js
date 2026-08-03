const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const ClienteVendedor = sequelize.define(
  "CLIENTE_VENDEDOR",
  {
    CLIENTE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    VENDEDOR: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = ClienteVendedor;
