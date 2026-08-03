const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const ConsecutivoFa = sequelize.define(
  "CONSECUTIVO_FA",
  {
    CODIGO_CONSECUTIVO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    VALOR_CONSECUTIVO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false }
);

module.exports = ConsecutivoFa;