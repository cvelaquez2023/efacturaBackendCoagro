const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");
const FrPromocionProducto = require("./FrPromocionProducto");
const FrPromocionDestino = require("./FrPromocionDestino");

/**
 * erpadmin.FR_PROMOCION: encabezado de la promocion de temporada.
 * TIPO: D = descuento, P = precio especial, B = bonificacion.
 * DESTINO: T = todos, R = rutas, K = tipos de cliente, C = clientes.
 * Si TIPO = B, ARTICULO_BONIFICADO y CANTIDAD_BONIFICADA son obligatorios;
 * si no, deben ir null (CHECK de la BD).
 */
const FrPromocion = sequelize.define(
  "FR_PROMOCION",
  {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    TITULO: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: { len: { args: [1, 120], msg: "TITULO admite un maximo de 120 caracteres" } },
    },
    DESCRIPCION: {
      type: DataTypes.STRING(500),
      validate: { len: { args: [0, 500], msg: "DESCRIPCION admite un maximo de 500 caracteres" } },
    },
    TIPO: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      validate: { isIn: { args: [["D", "P", "B"]], msg: "TIPO debe ser D (descuento), P (precio especial) o B (bonificacion)" } },
    },
    FECHA_INICIO: { type: DataTypes.DATEONLY, allowNull: false },
    FECHA_FIN: { type: DataTypes.DATEONLY, allowNull: false },
    DESTINO: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      validate: { isIn: { args: [["T", "R", "K", "C"]], msg: "DESTINO debe ser T (todos), R (rutas), K (tipos de cliente) o C (clientes)" } },
    },
    ARTICULO_BONIFICADO: {
      type: DataTypes.STRING(60),
      validate: { len: { args: [0, 60], msg: "ARTICULO_BONIFICADO admite un maximo de 60 caracteres" } },
    },
    CANTIDAD_BONIFICADA: {
      type: DataTypes.INTEGER,
      validate: {
        isInt: { msg: "CANTIDAD_BONIFICADA debe ser entero" },
        min: { args: [1], msg: "CANTIDAD_BONIFICADA debe ser mayor que 0" },
      },
    },
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

// constraints:false: las FK (con ON DELETE CASCADE) ya existen en la BD.
FrPromocion.hasMany(FrPromocionProducto, { as: "productos", foreignKey: "PROMOCION_ID", constraints: false });
FrPromocion.hasMany(FrPromocionDestino, { as: "destinos", foreignKey: "PROMOCION_ID", constraints: false });

module.exports = FrPromocion;
