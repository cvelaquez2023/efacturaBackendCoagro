const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Vista de solo lectura de la tabla CLIENTE del ERP (schema CINCOH, el
 * schema por defecto de la conexion). Solo expone los campos utiles para
 * escoger un cliente y asociarlo al modulo de rutas. NO se escribe aqui:
 * para crear/editar clientes del ERP se usa el CRUD de clientes existente.
 */
const ClienteErp = sequelize.define(
  "CLIENTE",
  {
    CLIENTE: { type: DataTypes.STRING, primaryKey: true },
    NOMBRE: { type: DataTypes.STRING },
    ALIAS: { type: DataTypes.STRING },
    CONTACTO: { type: DataTypes.STRING },
    DIRECCION: { type: DataTypes.STRING },
    TELEFONO1: { type: DataTypes.STRING },
    TELEFONO2: { type: DataTypes.STRING },
    FAX: { type: DataTypes.STRING },
    E_MAIL: { type: DataTypes.STRING },
    PAIS: { type: DataTypes.STRING },
    ZONA: { type: DataTypes.STRING },
    RUTA: { type: DataTypes.STRING },
    VENDEDOR: { type: DataTypes.STRING },
    COBRADOR: { type: DataTypes.STRING },
    ACTIVO: { type: DataTypes.STRING },
    GEO_LATITUD: { type: DataTypes.DECIMAL(28, 8) },
    GEO_LONGITUD: { type: DataTypes.DECIMAL(28, 8) },
  },
  {
    timestamps: false,
  }
);

module.exports = ClienteErp;
