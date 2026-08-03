const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const PedidoLinea = sequelize.define(
  "PEDIDO_LINEA",
  {
    PEDIDO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    PEDIDO_LINEA: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    BODEGA: {
      type: DataTypes.STRING,
    },
    ARTICULO: {
      type: DataTypes.STRING,
    },
    ESTADO: {
      type: DataTypes.STRING,
    },
    FECHA_ENTREGA: {
      type: DataTypes.STRING,
    },
    LINEA_USUARIO: {
      type: DataTypes.STRING,
    },
    PRECIO_UNITARIO: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_PEDIDA: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_A_FACTURA: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_FACTURADA: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_RESERVADA: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_BONIFICAD: {
      type: DataTypes.DECIMAL,
    },
    CANTIDAD_CANCELADA: {
      type: DataTypes.DECIMAL,
    },
    TIPO_DESCUENTO: {
      type: DataTypes.STRING,
    },
    MONTO_DESCUENTO: {
      type: DataTypes.DECIMAL,
    },
    PORC_DESCUENTO: {
      type: DataTypes.DECIMAL,
    },
    FECHA_PROMETIDA: {
      type: DataTypes.STRING,
    },
    CENTRO_COSTO: {
      type: DataTypes.STRING,
    },
    CUENTA_CONTABLE: {
      type: DataTypes.STRING,
    },
    TIPO_DESC: {
      type: DataTypes.STRING,
    },
    PORC_EXONERACION: {
      type: DataTypes.DECIMAL,
    },
    MONTO_EXONERACION: {
      type: DataTypes.DECIMAL,
    },
    PORC_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    PORC_IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    ES_OTRO_CARGO: {
      type: DataTypes.STRING,
    },
    ES_CANASTA_BASICA: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);
module.exports = PedidoLinea;
