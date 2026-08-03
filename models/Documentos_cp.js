const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const DocumentosCp = sequelize.define(
  "DOCUMENTOS_CP",
  {
    PROVEEDOR: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    DOCUMENTO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    ASIENTO: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = DocumentosCp;
