const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * erpadmin.FR_PROMOCION_BONIFICADO: articulos que regala una promocion de bonificacion (TIPO 'B').
 * Una promocion puede regalar varios ("me llevo X y me dan Y y Z"). Proporcional: por cada
 * CANTIDAD_MIN unidades de un producto de la promocion se regala CANTIDAD de cada articulo.
 * FK PROMOCION_ID con ON DELETE CASCADE; UNIQUE (PROMOCION_ID, ARTICULO).
 * Script: docs/fr-promocion-bonificados.sql.
 */
const FrPromocionBonificado = sequelize.define(
  "FR_PROMOCION_BONIFICADO",
  {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    PROMOCION_ID: { type: DataTypes.INTEGER, allowNull: false },
    ARTICULO: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { len: { args: [1, 20], msg: "ARTICULO bonificado admite un maximo de 20 caracteres" } },
    },
    CANTIDAD: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: { msg: "La cantidad bonificada debe ser entera" },
        min: { args: [1], msg: "La cantidad bonificada debe ser mayor que 0" },
      },
    },
  },
  {
    schema: "ERPADMIN",
    tableName: "FR_PROMOCION_BONIFICADO",
    timestamps: false,
  }
);

module.exports = FrPromocionBonificado;
