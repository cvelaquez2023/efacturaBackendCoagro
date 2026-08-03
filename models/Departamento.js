const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Departamento = sequelize.define(
  "DEPARTAMENTO",
  {
    DEPARTAMENTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    ACTIVO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Departamento;
