const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Bodegas del modulo de rutas. La BODEGA se toma de la tabla BODEGA del ERP
 * (ver BodegaErp); aqui solo se guarda el codigo y el nombre.
 *
 * Largos estimados: confirmar con INFORMATION_SCHEMA de erpadmin.BODEGA_RT.
 */
const BodegaRt = sequelize.define(
  "BODEGA_RT",
  {
    BODEGA: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    NOMBRE: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = BodegaRt;
