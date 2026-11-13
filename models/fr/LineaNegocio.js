const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Catalogo CINCOH.LineaNegocio (metas de venta).
 * id int identity (PK), codigo varchar(4) NOT NULL UNIQUE,
 * nombre varchar(100) NOT NULL, activa bit NULL default 1.
 */
const LineaNegocio = sequelize.define(
  "LineaNegocio",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        len: { args: [1, 4], msg: "El codigo debe tener entre 1 y 4 caracteres" },
      },
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: { args: [1, 100], msg: "El nombre debe tener entre 1 y 100 caracteres" },
      },
    },
    activa: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    schema: "CINCOH",
    timestamps: false,
  }
);

module.exports = LineaNegocio;
