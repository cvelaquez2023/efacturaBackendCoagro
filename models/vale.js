const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const vale = sequelize.define(
  "VALE",
  {
    CONSECUTIVO: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    DEPARTAMENTO: {
      type: DataTypes.STRING,
    },
    CAJA_CHICA: {
      type: DataTypes.STRING,
    },
    VALE: {
      type: DataTypes.INTEGER,
    },
    FECHA_EMISION: {
      type: DataTypes.STRING,
    },
    CONCEPTO_VALE: {
      type: DataTypes.STRING,
    },
    BENEFICIARIO: {
      type: DataTypes.STRING,
    },
    MONTO_CAJA: {
      type: DataTypes.DECIMAL,
    },
    MONTO_LOCAL: {
      type: DataTypes.DECIMAL,
    },
    MONTO_DOLAR: {
      type: DataTypes.DECIMAL,
    },
    TIPO_CAMB_CAJA: {
      type: DataTypes.DECIMAL,
    },
    TIPO_CAMB_DOLAR: {
      type: DataTypes.DECIMAL,
    },
    ESTADO: {
      type: DataTypes.STRING,
    },
    USUARIO_CREACION: {
      type: DataTypes.STRING,
    },
    FECHA_CREACION: {
      type: DataTypes.STRING,
    },
    ADMIN_CREACION: {
      type: DataTypes.STRING,
    },
    USUARIO_MODIFIC: {
      type: DataTypes.STRING,
    },
    FECHA_MODIFIC: {
      type: DataTypes.STRING,
    },
    ADMIN_MODIFIC: {
      type: DataTypes.STRING,
    },
    MONTO_VALE: {
      type: DataTypes.DECIMAL,
    },
    MONTO_EFECTIVO: {
      type: DataTypes.DECIMAL,
    },
    REINTEGRO: {
      type: DataTypes.DECIMAL,
    },
    FACTURA_ELECTRONICA: {
      type: DataTypes.STRING,
    },
    SUBTOTAL_BIENES: {
      type: DataTypes.DECIMAL,
    },
    SUBTOTAL_SERVICIOS: {
      type: DataTypes.DECIMAL,
    },
    DESTINO_ITBIS: {
      type: DataTypes.STRING,
    },
    TIPO_CF: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = vale;
