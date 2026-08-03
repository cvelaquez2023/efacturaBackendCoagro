const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Usuarios = sequelize.define(
  "usuario",
  {
    usuario_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
    },
    nombres: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    token: {
      type: DataTypes.STRING,
    },
    activo: {
      type: DataTypes.BOOLEAN,
    },
    rol: {
      type: DataTypes.STRING,
    },
    confirm_token: {
      type: DataTypes.STRING,
    },
    confirm: {
      type: DataTypes.BOOLEAN,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Usuarios;
