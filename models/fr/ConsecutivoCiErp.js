const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Vista de solo lectura de CONSECUTIVO_CI del ERP (schema CINCOH, el schema
 * por defecto de la conexion). Sirve para escoger el consecutivo que se
 * asocia a una bodega en BODEGA_ASOC_RT.
 */
const ConsecutivoCiErp = sequelize.define(
  "CONSECUTIVO_CI",
  {
    CONSECUTIVO: { type: DataTypes.STRING, primaryKey: true },
    DESCRIPCION: { type: DataTypes.STRING },
    MASCARA: { type: DataTypes.STRING },
    SIGUIENTE_CONSEC: { type: DataTypes.STRING },
    EDITABLE: { type: DataTypes.STRING },
    MULTIPLES_TRANS: { type: DataTypes.STRING },
    TODAS_TRANS: { type: DataTypes.STRING },
    TIPO: { type: DataTypes.STRING },
    USA_TRASLADO: { type: DataTypes.STRING },
  },
  {
    timestamps: false,
  }
);

module.exports = ConsecutivoCiErp;
