const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Vista de solo lectura de la tabla BODEGA del ERP (schema CINCOH, el schema
 * por defecto de la conexion). Sirve para escoger una bodega y darla de alta
 * en el modulo de rutas.
 */
const BodegaErp = sequelize.define(
  "BODEGA",
  {
    BODEGA: { type: DataTypes.STRING, primaryKey: true },
    NOMBRE: { type: DataTypes.STRING },
    TIPO: { type: DataTypes.STRING },
    TELEFONO: { type: DataTypes.STRING },
    DIRECCION: { type: DataTypes.STRING },
    U_SUCURSAL: { type: DataTypes.STRING },
    U_COORDINADAS: { type: DataTypes.STRING },
    CODIGO_ESTABLECIMIENTO: { type: DataTypes.STRING },
  },
  {
    timestamps: false,
  }
);

module.exports = BodegaErp;
