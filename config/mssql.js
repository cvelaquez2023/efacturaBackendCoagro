const { Sequelize } = require("sequelize");

const database = process.env.SQL_DATABASE;
const username = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;
const host = process.env.SQL_HOST;
const schema = process.env.SQL_SCHEMA;

//const sequelize = new Sequelize(database, username, "Master#$2021", {
const sequelize = new Sequelize(database, username, password, {
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
