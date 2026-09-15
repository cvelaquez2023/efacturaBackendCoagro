const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Agentes del modulo de rutas. El AGENTE se toma de la tabla VENDEDOR del
 * ERP (ver VendedorErp); aqui solo se guarda el codigo y el nombre.
 *
 * Largos estimados: confirmar con INFORMATION_SCHEMA de erpadmin.AGENTE_RT.
 */
const AgenteRt = sequelize.define(
  "AGENTE_RT",
  {
    AGENTE: {
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

module.exports = AgenteRt;
