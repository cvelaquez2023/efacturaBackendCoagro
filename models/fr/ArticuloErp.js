const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Vista de solo lectura de la tabla ARTICULO del ERP (schema CINCOH, el
 * schema por defecto de la conexion). Solo expone los campos utiles para
 * escoger un articulo y darlo de alta en el modulo de rutas. NO se escribe
 * aqui: para crear/editar articulos del ERP se usa el CRUD existente.
 */
const ArticuloErp = sequelize.define(
  "ARTICULO",
  {
    ARTICULO: { type: DataTypes.STRING, primaryKey: true },
    DESCRIPCION: { type: DataTypes.STRING },
    CLASIFICACION_1: { type: DataTypes.STRING },
    CLASIFICACION_2: { type: DataTypes.STRING },
    CLASIFICACION_3: { type: DataTypes.STRING },
    CLASIFICACION_4: { type: DataTypes.STRING },
    CLASIFICACION_5: { type: DataTypes.STRING },
    CLASIFICACION_6: { type: DataTypes.STRING },
    TIPO: { type: DataTypes.STRING },
    UNIDAD_ALMACEN: { type: DataTypes.STRING },
    UNIDAD_EMPAQUE: { type: DataTypes.STRING },
    UNIDAD_VENTA: { type: DataTypes.STRING },
    CODIGO_BARRAS_VENT: { type: DataTypes.STRING },
    GTIN: { type: DataTypes.STRING },
    PESO_NETO: { type: DataTypes.DECIMAL(28, 8) },
    PESO_BRUTO: { type: DataTypes.DECIMAL(28, 8) },
    VOLUMEN: { type: DataTypes.DECIMAL(28, 8) },
    PRECIO_BASE_LOCAL: { type: DataTypes.DECIMAL(28, 8) },
    PRECIO_BASE_DOLAR: { type: DataTypes.DECIMAL(28, 8) },
    PROVEEDOR: { type: DataTypes.STRING },
  },
  {
    timestamps: false,
  }
);

module.exports = ArticuloErp;
