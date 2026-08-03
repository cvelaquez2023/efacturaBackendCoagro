const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const NCFsecuencia = sequelize.define(
  "NCF_SECUENCIA",
  {
    PREFIJO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    ULTIMO_VALOR: {
      type: DataTypes.INTEGER,
    },

    ESTADO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = NCFsecuencia;
