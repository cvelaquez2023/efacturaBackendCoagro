const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Clasificacion = sequelize.define(
  "CLASIFICACION",
  {
    CLASIFICACION: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    AGRUPACION: {
      type: DataTypes.NUMBER,
    },
    PADRE: {
      type: DataTypes.STRING,
    },
    IMAGEN1: {
      type: DataTypes.STRING,
    },
    IMAGEN2: {
      type: DataTypes.STRING,
    },
    IMAGEN3: {
      type: DataTypes.STRING,
    },
    IMAGEN4: {
      type: DataTypes.STRING,
    },
    IMAGEN5: {
      type: DataTypes.STRING,
    },
    SLIDER: {
      type: DataTypes.BOOLEAN,
    },
    VISITAS: {
      type: DataTypes.DECIMAL,
    },
  },
  { timestamps: false }
);

module.exports = Clasificacion;
