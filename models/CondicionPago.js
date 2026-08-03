const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const CondicionPago = sequelize.define(
  "CONDICION_PAGO",
  {
    CONDICION_PAGO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    DIAS_NETO: {
      type: DataTypes.DECIMAL,
    },
    cat016: {
      type: DataTypes.INTEGER,
    },
    cat017: {
      type: DataTypes.STRING,
    },
    cat018: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = CondicionPago;
