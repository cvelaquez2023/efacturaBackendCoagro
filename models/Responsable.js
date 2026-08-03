const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Responsable = sequelize.define(
  "RESPONSABLE",
  {
    RESPONSABLE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    NOMBRE: {
      type: DataTypes.STRING,
    },

    
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Responsable;
