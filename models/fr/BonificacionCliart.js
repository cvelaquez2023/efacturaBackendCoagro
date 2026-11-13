const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Bonificacion por cliente y articulo: regala UNIDADES_BONIF de ARTICULO_BONIF, por rango de cantidades y fechas.
 *
 * Tabla nativa de [COAGRO2].erpadmin.BONIFICACION_CLIART (la baja la handheld). Tipos/largos segun
 * INFORMATION_SCHEMA real (nov 2026); todas las columnas NOT NULL salvo las marcadas.
 * PK real: COMPANIA + entidad + CANT_MIN + CANT_MAX + FECHA_INICIO + FECHA_FIN.
 * COMPANIA se guarda siempre 'COAGRO' (ver controllers/fr/descuentoBase.js).
 * FECHA_* son datetime en BD; se manejan como fecha sin hora (YYYY-MM-DD).
 */
const texto = (nombre, maxLen, extra = {}) => ({
  type: DataTypes.STRING(maxLen),
  allowNull: false,
  validate: {
    len: { args: [1, maxLen], msg: `El campo ${nombre} debe tener entre 1 y ${maxLen} caracteres` },
  },
  ...extra,
});

const entero = (nombre) => ({
  type: DataTypes.INTEGER,
  allowNull: false,
  primaryKey: true,
  validate: { isInt: { msg: `El campo ${nombre} debe ser un numero entero` } },
});

const fecha = (nombre) => ({
  type: DataTypes.DATEONLY,
  allowNull: false,
  primaryKey: true,
  validate: { isDate: { msg: `El campo ${nombre} debe ser una fecha valida` } },
});

const decimal = (nombre, allowNull = false) => ({
  type: DataTypes.DECIMAL(28, 8),
  allowNull,
  validate: { isDecimal: { msg: `El campo ${nombre} debe ser numerico` } },
});

const BonificacionCliart = sequelize.define(
  "BONIFICACION_CLIART",
  {
    COMPANIA: texto("COMPANIA", 10, { primaryKey: true }),
    CLIENTE: texto("CLIENTE", 20, { primaryKey: true }),
    ARTICULO: texto("ARTICULO", 20, { primaryKey: true }),
    CANT_MIN: entero("CANT_MIN"),
    CANT_MAX: entero("CANT_MAX"),
    FECHA_INICIO: fecha("FECHA_INICIO"),
    FECHA_FIN: fecha("FECHA_FIN"),
    ARTICULO_BONIF: texto("ARTICULO_BONIF", 20),
    UNIDADES_BONIF: decimal("UNIDADES_BONIF"),
    FACTOR_BONIF: decimal("FACTOR_BONIF", true), // nullable
  },
  {
    schema: "ERPADMIN",
    tableName: "BONIFICACION_CLIART",
    timestamps: false,
  }
);

module.exports = BonificacionCliart;
