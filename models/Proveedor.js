const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Proveedores_cp = sequelize.define(
  "PROVEEDOR",
  {
    PROVEEDOR: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    CONTRIBUYENTE: {
      type: DataTypes.STRING,
    },
    CONDICION_PAGO: {
      type: DataTypes.STRING,
    },
    CODIGO_IMPUESTO: {
      type: DataTypes.STRING,
    },
    MONEDA: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Proveedores_cp;
