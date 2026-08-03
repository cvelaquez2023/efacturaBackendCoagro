const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const Visita = sequelize.define(
  "VISITA",
  {
    CLIENTE: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    RUTA: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    INICIO: {
      type: DataTypes.DATE,
      primaryKey: true,
    },
    RAZON: { type: DataTypes.STRING },
    FIN: { type: DataTypes.DATE },
    FECHA_PLAN: { type: DataTypes.DATE },
    TIPO: { type: DataTypes.STRING },
    NOTAS: { type: DataTypes.STRING },
    DOC_PRO: { type: DataTypes.STRING },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = Visita;
