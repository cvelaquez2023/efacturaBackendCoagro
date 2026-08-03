const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const Dte = sequelize.define(
  "DTE.dbo.DTES",
  {
    Dte_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },
    Dte: {
      type: DataTypes.STRING,
    },
    firma: {
      type: DataTypes.STRING,
    },
    origen: {
      type: DataTypes.STRING,
    },
    createDate: {
      type: DataTypes.DATE,
    },
    updateDate: {
      type: DataTypes.DATE,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Dte;
