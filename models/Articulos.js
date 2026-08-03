const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Articulo = sequelize.define(
  "ARTICULO",
  {
    ARTICULO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_1: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_2: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_3: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_4: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_5: {
      type: DataTypes.STRING,
    },
    CLASIFICACION_6: {
      type: DataTypes.STRING,
    },
    PESO_NETO: {
      type: DataTypes.NUMBER,
    },
    PESO_BRUTO: {
      type: DataTypes.NUMBER,
    },
    VOLUMEN: {
      type: DataTypes.NUMBER,
    },
    ACTIVO: {
      type: DataTypes.NUMBER,
    },
    ESTILO: {
      type: DataTypes.STRING,
    },
    TALLA: {
      type: DataTypes.STRING,
    },
    COLOR: {
      type: DataTypes.BOOLEAN,
    },
    GALERIA_IMAGENES: {
      type: DataTypes.JSON,
    },
    IMAGEN_VERTICAL: {
      type: DataTypes.STRING,
    },
    IMAGEN_HORIZONTAL: {
      type: DataTypes.STRING,
    },
    IMAGEN: {
      type: DataTypes.STRING,
    },
    ESPECIFICACIONES: {
      type: DataTypes.JSON,
    },
    VISTAS: {
      type: DataTypes.DECIMAL,
    },
    VER_TIENDA: {
      type: DataTypes.BOOLEAN,
    },
  },
  { timestamps: false }
);

module.exports = Articulo;
