const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * erpadmin.FR_CONDICION_CLIENTE: descuento maximo o precio especial por cliente.
 * ALCANCE: A = articulo, L = linea (CLASIFICACION_3), T = texto en la descripcion.
 * FECHA_FIN null = no vence. ACTIVA S/N. ID identity.
 * CLIENTE: texto libre por ahora (la tabla de clientes se define mas adelante,
 * ver docs/pendientes-fr-promociones.sql).
 */
const FrCondicionCliente = sequelize.define(
  "FR_CONDICION_CLIENTE",
  {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    CLIENTE: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { len: { args: [1, 20], msg: "CLIENTE admite un maximo de 20 caracteres" } },
    },
    ALCANCE: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      validate: { isIn: { args: [["A", "L", "T"]], msg: "ALCANCE debe ser A (articulo), L (linea) o T (texto)" } },
    },
    VALOR: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: { len: { args: [1, 60], msg: "VALOR admite un maximo de 60 caracteres" } },
    },
    DESCUENTO_MAX: {
      type: DataTypes.DECIMAL(5, 2),
      validate: {
        min: { args: [0.01], msg: "DESCUENTO_MAX debe ser mayor que 0" },
        max: { args: [100], msg: "DESCUENTO_MAX no puede ser mayor que 100" },
      },
    },
    PRECIO_ESPECIAL: {
      type: DataTypes.DECIMAL(28, 8),
      validate: { min: { args: [0.00000001], msg: "PRECIO_ESPECIAL debe ser mayor que 0" } },
    },
    CANTIDAD_MIN: {
      type: DataTypes.INTEGER,
      validate: {
        isInt: { msg: "CANTIDAD_MIN debe ser entero" },
        min: { args: [1], msg: "CANTIDAD_MIN debe ser mayor que 0" },
      },
    },
    FECHA_INICIO: { type: DataTypes.DATEONLY, allowNull: false },
    FECHA_FIN: { type: DataTypes.DATEONLY },
    ACTIVA: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      defaultValue: "S",
      validate: { isIn: { args: [["S", "N"]], msg: "ACTIVA debe ser S o N" } },
    },
    CREADO_POR: { type: DataTypes.STRING(50), allowNull: false },
    FECHA_CREACION: { type: DataTypes.DATE },
    MODIFICADO_POR: { type: DataTypes.STRING(50) },
    FECHA_MODIFICACION: { type: DataTypes.DATE },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = FrCondicionCliente;
