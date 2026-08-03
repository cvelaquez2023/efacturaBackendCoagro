const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const FacturaLinea = sequelize.define(
  "FACTURA_LINEA",
  {
    FACTURA: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    LINEA: {
      type: DataTypes.INTEGER,
    },
    ARTICULO: {
      type: DataTypes.STRING,
    },
    LOTE: {
      type: DataTypes.STRING,
    },
    CANTIDAD: {
      type: DataTypes.DECIMAL,
    },
    PRECIO_UNITARIO: {
      type: DataTypes.DECIMAL,
    },
    DESC_TOT_LINEA: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    DESCUENTO_VOLUMEN: {
      type: DataTypes.DECIMAL,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = FacturaLinea;
