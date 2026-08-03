const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const SubTipoDocCp = sequelize.define(
  "SUBTIPO_DOC_CC",
  {
    TIPO: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    SUBTIPO: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    DESCRIPCION: {
      type: DataTypes.STRING,
    },
    ct002: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = SubTipoDocCp;
