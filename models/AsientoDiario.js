const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const AsientoDiario = sequelize.define(
  "ASIENTO_DE_DIARIO",
  {
    ASIENTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    PAQUETE: {
      type: DataTypes.DECIMAL,
    },
    TIPO_ASIENTO: {
      type: DataTypes.STRING,
    },
    FECHA: {
      type: DataTypes.DATE,
    },
    CONTABILIDAD: {
      type: DataTypes.STRING,
    },
    ORIGEN: {
      type: DataTypes.STRING,
    },
    CLASE_ASIENTO: {
      type: DataTypes.STRING,
    },
    TOTAL_DEBITO_LOC: {
      type: DataTypes.NUMBER,
    },
    TOTAL_CREDITO_LOC: {
      type: DataTypes.NUMBER,
    },
    NOTAS: {
      type: DataTypes.STRING,
    },
    FECHA_CREACION: {
      type: DataTypes.DATE,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = AsientoDiario;
