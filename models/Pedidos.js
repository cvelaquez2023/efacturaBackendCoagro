const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const Pedido = sequelize.define(
  "PEDIDO",
  {
    PEDIDO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    ESTADO: {
      type: DataTypes.STRING,
    },
    FECHA_PEDIDO: {
      type: DataTypes.STRING,
    },
    FECHA_PROMETIDA: {
      type: DataTypes.STRING,
    },
    FECHA_PROX_EMBARQU: {
      type: DataTypes.STRING,
    },
    FECHA_ULT_EMBARQUE: {
      type: DataTypes.STRING,
    },
    FECHA_ULT_CANCELAC: {
      type: DataTypes.STRING,
    },
    FECHA_ORDEN: {
      type: DataTypes.STRING,
    },
    EMBARCAR_A: {
      type: DataTypes.STRING,
    },
    DIREC_EMBARQUE: {
      type: DataTypes.STRING,
    },
    DIRECCION_FACTURA: {
      type: DataTypes.STRING,
    },
    OBSERVACIONES: {
      type: DataTypes.STRING,
    },
    TOTAL_MERCADERIA: {
      type: DataTypes.DECIMAL,
    },
    MONTO_ANTICIPO: {
      type: DataTypes.DECIMAL,
    },
    MONTO_FLETE: {
      type: DataTypes.DECIMAL,
    },
    MONTO_SEGURO: {
      type: DataTypes.DECIMAL,
    },
    MONTO_DOCUMENTACIO: {
      type: DataTypes.DECIMAL,
    },
    TIPO_DESCUENTO1: {
      type: DataTypes.STRING,
    },
    TIPO_DESCUENTO2: {
      type: DataTypes.STRING,
    },
    MONTO_DESCUENTO1: {
      type: DataTypes.DECIMAL,
    },
    MONTO_DESCUENTO2: {
      type: DataTypes.DECIMAL,
    },
    PORC_DESCUENTO1: {
      type: DataTypes.DECIMAL,
    },
    PORC_DESCUENTO2: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_A_FACTURAR: {
      type: DataTypes.DECIMAL,
    },
    PORC_COMI_VENDEDOR: {
      type: DataTypes.DECIMAL,
    },
    PORC_COMI_COBRADOR: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_CANCELADO: {
      type: DataTypes.DECIMAL,
    },
    TOTAL_UNIDADES: {
      type: DataTypes.DECIMAL,
    },
    IMPRESO: {
      type: DataTypes.STRING,
    },
    FECHA_HORA: {
      type: DataTypes.STRING,
    },
    DESCUENTO_VOLUMEN: {
      type: DataTypes.DECIMAL,
    },
    TIPO_PEDIDO: {
      type: DataTypes.STRING,
    },
    MONEDA_PEDIDO: {
      type: DataTypes.STRING,
    },
    VERSION_NP: {
      type: DataTypes.INTEGER,
    },
    AUTORIZADO: {
      type: DataTypes.STRING,
    },
    DOC_A_GENERAR: {
      type: DataTypes.STRING,
    },
    CLASE_PEDIDO: {
      type: DataTypes.STRING,
    },
    MONEDA: {
      type: DataTypes.STRING,
    },
    NIVEL_PRECIO: {
      type: DataTypes.STRING,
    },
    COBRADOR: {
      type: DataTypes.STRING,
    },
    RUTA: {
      type: DataTypes.STRING,
    },
    USUARIO: {
      type: DataTypes.STRING,
    },
    CONDICION_PAGO: {
      type: DataTypes.STRING,
    },
    BODEGA: {
      type: DataTypes.STRING,
    },
    ZONA: {
      type: DataTypes.STRING,
    },
    VENDEDOR: {
      type: DataTypes.STRING,
    },
    CLIENTE: {
      type: DataTypes.STRING,
    },
    CLIENTE_DIRECCION: {
      type: DataTypes.STRING,
    },
    CLIENTE_CORPORAC: {
      type: DataTypes.STRING,
    },
    CLIENTE_ORIGEN: {
      type: DataTypes.STRING,
    },
    PAIS: {
      type: DataTypes.STRING,
    },
    SUBTIPO_DOC_CXC: {
      type: DataTypes.STRING,
    },
    TIPO_DOC_CXC: {
      type: DataTypes.STRING,
    },
    BACKORDER: {
      type: DataTypes.STRING,
    },
    PORC_INTCTE: {
      type: DataTypes.DECIMAL,
    },
    DESCUENTO_CASCADA: {
      type: DataTypes.STRING,
    },
    FIJAR_TIPO_CAMBIO: {
      type: DataTypes.STRING,
    },
    ORIGEN_PEDIDO: {
      type: DataTypes.STRING,
    },
    BASE_IMPUESTO1: {
      type: DataTypes.DECIMAL,
    },
    BASE_IMPUESTO2: {
      type: DataTypes.DECIMAL,
    },
    NOMBRE_CLIENTE: {
      type: DataTypes.STRING,
    },
    FECHA_PROYECTADA: {
      type: DataTypes.STRING,
    },
    TIPO_DOCUMENTO: {
      type: DataTypes.STRING,
    },
    TASA_IMPOSITIVA_PORC: {
      type: DataTypes.DECIMAL,
    },
    TASA_CREE1_PORC: {
      type: DataTypes.DECIMAL,
    },
    TASA_CREE2_PORC: {
      type: DataTypes.DECIMAL,
    },
    TASA_GAN_OCASIONAL_PORC: {
      type: DataTypes.DECIMAL,
    },
    CONTRATO_REVENTA: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Pedido;
