const { Sequelize } = require("sequelize");

/**
 * SQL Server: las columnas `datetime` no aceptan el offset de zona horaria
 * ("+00:00") que Sequelize agrega al serializar los DataTypes.DATE, y
 * responden con el error 241 "Conversion failed when converting date and/or
 * time from character string". Serializamos la fecha sin el offset.
 */
Sequelize.DATE.prototype._stringify = function (date, options) {
  date = this._applyTimezone(date, options);
  return date.format("YYYY-MM-DD HH:mm:ss.SSS");
};

/**
 * SQL Server: las columnas `date` (DataTypes.DATEONLY) llegan de tedious como
 * medianoche UTC, y Sequelize las formateaba en hora local (UTC-6), devolviendo
 * el dia anterior (se guardaba 2026-01-01 y se leia 2025-12-31). Se formatea en
 * UTC. Debe ir antes de `new Sequelize` (el parser se registra al conectar).
 */
const moment = require("moment");
Sequelize.DataTypes.mssql.DATEONLY.parse = (value) => moment.utc(value).format("YYYY-MM-DD");

const database = process.env.SQL_DATABASE;
const username = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;
const host = process.env.SQL_HOST;
const schema = process.env.SQL_SCHEMA;

//const sequelize = new Sequelize(database, username, "Master#$2021", {
const sequelize = new Sequelize(database, username, password, {
//database - COAGRO2
//user - sa
//Password - Houdelot777$

  host: host,
  dialect: "mssql",
  omitNull: true,
  port: 1433,
  schema: schema,
  define: {
    freezeTableName: true,
    timestamps: false,
  },
  logging: false,
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
      requestTimeout: 300000,
    },
  },
});
const dbConnect = async () => {
  try {
    await sequelize.authenticate();
    console.log("conexion correcta", database, schema);
  } catch (error) {
    console.log("Error de conecion", error);
  }
};

module.exports = { sequelize, dbConnect };
