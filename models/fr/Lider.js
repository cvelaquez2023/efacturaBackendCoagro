const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Catalogo CINCOH.Lider (metas de venta).
 * id int identity (PK), codigo varchar(4) NOT NULL UNIQUE,
 * nombre varchar(100) NOT NULL, email varchar(100) NULL UNIQUE,
 * activo bit NULL default 1.
 * OJO: el UNIQUE de email en SQL Server solo admite UN registro con NULL.
 */
const Lider = sequelize.define(
  "Lider",
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
    email: {
      type: DataTypes.STRING(100),
      validate: {
        len: { args: [0, 100], msg: "El email admite un maximo de 100 caracteres" },
        isEmail: { msg: "El email no tiene un formato valido" },
      },
    },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    schema: "CINCOH",
    timestamps: false,
  }
);

module.exports = Lider;
