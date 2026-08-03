const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");
const Factura = sequelize.define(
  "FACTURA",
  {
    FACTURA: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    CLIENTE: {
      type: DataTypes.STRING,
    },
    FECHA_HORA: {
      type: DataTypes.STRING,
    },
    SUBTIPO_DOC_CXC: {
      type: DataTypes.INTEGER,
    },
    TIPO_CREDITO_CXC: {
      type: DataTypes.STRING,
    },
    COMENTARIO_CXC: {
      type: DataTypes.STRING,
    },
    DOC_FISCAL:{
      type:DataTypes.STRING
    }
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Factura;
