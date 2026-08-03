const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Empleado = sequelize.define(
  "EMPLEADO",
  {
    EMPLEADO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    NOMBRE: {
      type: DataTypes.STRING,
    },

    ACTIVO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Empleado;
