const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * erpadmin.FR_PROMOCION_PRODUCTO: a que productos aplica una promocion.
 * ALCANCE A/L/T igual que FR_CONDICION_CLIENTE. FK PROMOCION_ID con ON DELETE CASCADE.
 */
const FrPromocionProducto = sequelize.define(
  "FR_PROMOCION_PRODUCTO",
  {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    PROMOCION_ID: { type: DataTypes.INTEGER, allowNull: false },
    ALCANCE: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      validate: { isIn: { args: [["A", "L", "T"]], msg: "ALCANCE del producto debe ser A, L o T" } },
    },
    VALOR: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: { len: { args: [1, 60], msg: "VALOR del producto admite un maximo de 60 caracteres" } },
    },
    CANTIDAD_MIN: {
      type: DataTypes.INTEGER,
      validate: {
        isInt: { msg: "CANTIDAD_MIN debe ser entero" },
        min: { args: [1], msg: "CANTIDAD_MIN debe ser mayor que 0" },
      },
    },
    DESCUENTO: {
      type: DataTypes.DECIMAL(5, 2),
      validate: {
        min: { args: [0.01], msg: "DESCUENTO debe ser mayor que 0" },
        max: { args: [100], msg: "DESCUENTO no puede ser mayor que 100" },
      },
    },
    PRECIO_ESPECIAL: {
      type: DataTypes.DECIMAL(28, 8),
      validate: { min: { args: [0.00000001], msg: "PRECIO_ESPECIAL debe ser mayor que 0" } },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = FrPromocionProducto;
