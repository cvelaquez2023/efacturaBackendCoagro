const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * erpadmin.FR_PROMOCION_DESTINO: a quien va dirigida una promocion.
 * TIPO: R = ruta, K = tipo de cliente, C = cliente. PK (PROMOCION_ID, TIPO, VALOR).
 * FK PROMOCION_ID con ON DELETE CASCADE.
 */
const FrPromocionDestino = sequelize.define(
  "FR_PROMOCION_DESTINO",
  {
    PROMOCION_ID: { type: DataTypes.INTEGER, primaryKey: true },
    TIPO: {
      type: DataTypes.CHAR(1),
      primaryKey: true,
      validate: { isIn: { args: [["R", "K", "C"]], msg: "TIPO de destino debe ser R, K o C" } },
    },
    VALOR: {
      type: DataTypes.STRING(60),
      primaryKey: true,
      validate: { len: { args: [1, 60], msg: "VALOR del destino admite un maximo de 60 caracteres" } },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = FrPromocionDestino;
