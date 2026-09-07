const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Vista de solo lectura de la tabla VENDEDOR del ERP (schema CINCOH, el
 * schema por defecto de la conexion). Sirve para escoger un vendedor y
 * darlo de alta como agente en el modulo de rutas.
 */
const VendedorErp = sequelize.define(
  "VENDEDOR",
  {
    VENDEDOR: { type: DataTypes.STRING, primaryKey: true },
    NOMBRE: { type: DataTypes.STRING },
    EMPLEADO: { type: DataTypes.STRING },
    COMISION: { type: DataTypes.DECIMAL(28, 8) },
    E_MAIL: { type: DataTypes.STRING },
    Correo: { type: DataTypes.STRING },
    telefono: { type: DataTypes.STRING },
    ACTIVO: { type: DataTypes.STRING },
  },
  {
    timestamps: false,
  }
);

module.exports = VendedorErp;
