const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const cajaChica = sequelize.define(
  "CAJA_CHICA",
  {
    CAJA_CHICA: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    SALDO: {
      type: DataTypes.DECIMAL,
    },
    ESTADO: {
      type: DataTypes.STRING,
    },
    ULTIMO_CONSECUTIVO: {
      type: DataTypes.INTEGER,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = cajaChica;
