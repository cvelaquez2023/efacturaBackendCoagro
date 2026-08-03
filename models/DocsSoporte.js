const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const DocsSoporte = sequelize.define(
  "DOCS_SOPORTE",
  {
    VALE: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    LINEA: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    CENTRO_COSTO: {
      type: DataTypes.STRING,
    },
    CUENTA_CONTABLE: {
      type: DataTypes.STRING,
    },
    NIT: {
      type: DataTypes.STRING,
    },
    DOC_SOPORTE: {
      type: DataTypes.STRING,
    },
    TIPO: {
      type: DataTypes.STRING,
    },
    MONTO: {
      type: DataTypes.DECIMAL,
    },
    MONTO_VALE: {
      type: DataTypes.DECIMAL,
    },
    CONCEPTO: {
      type: DataTypes.STRING,
    },
    DETALLE: {
      type: DataTypes.STRING,
    },
    SUBTOTAL: {
      type: DataTypes.DECIMAL,
    },
    IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    RUBRO1: {
      type: DataTypes.DECIMAL,
    },
    RUBRO2: {
      type: DataTypes.DECIMAL,
    },
    DESCUENTO: {
      type: DataTypes.DECIMAL,
    },
    SUBTIPO: {
      type: DataTypes.INTEGER,
    },
    FECHA: {
      type: DataTypes.STRING,
    },
    FECHA_RIGE: {
      type: DataTypes.STRING,
    },
    CODIGO_IMPUESTO: {
      type: DataTypes.STRING,
    },
    BASE_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    BASE_IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    IMP1_AFECTA_COSTO: {
      type: DataTypes.STRING,
    },
    IMP1_ASUMIDO_DESC: {
      type: DataTypes.DECIMAL,
    },
    IMP1_ASUMIDO_NODESC: {
      type: DataTypes.DECIMAL,
    },
    SUBTOTAL_BIENES: {
      type: DataTypes.DECIMAL,
    },
    SUBTOTAL_SERVICIOS: {
      type: DataTypes.DECIMAL,
    },
    CLASE_DOC_ES: {
      type: DataTypes.INTEGER,
    },
    DOCUMENTO_FISCAL: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = DocsSoporte;
