const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Catalogo CINCOH.ProveedorMeta (metas de venta).
 * id int identity (PK), codigo varchar(8) NOT NULL UNIQUE,
 * nombre varchar(100) NOT NULL, activo bit NOT NULL default 1,
 * FechaCreacion datetime default getdate(), UsuarioCreacion varchar(50).
 */
const ProveedorMeta = sequelize.define(
  "ProveedorMeta",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        len: { args: [1, 8], msg: "El codigo debe tener entre 1 y 8 caracteres" },
      },
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: { args: [1, 100], msg: "El nombre debe tener entre 1 y 100 caracteres" },
      },
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    FechaCreacion: { type: DataTypes.DATE },
    UsuarioCreacion: { type: DataTypes.STRING(50) },
  },
  {
    schema: "CINCOH",
    timestamps: false,
  }
);

module.exports = ProveedorMeta;
