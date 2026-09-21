const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Tabla nativa del ERP (no es una "_RT" nueva del modulo): asigna un cliente
 * a una ruta en un dia especifico de la semana, con un orden de visita.
 * PK compuesta real en BD (XPKRUTACLIENTE): RUTA, CLIENTE, DIA. Sin columna
 * COMPANIA (no aplica ningun ALTER aqui).
 *
 * Largos segun INFORMATION_SCHEMA real de erpadmin.RUTA_CLIENTE:
 * RUTA varchar(4) NOT NULL, CLIENTE varchar(20) NOT NULL, DIA int NOT NULL,
 * ORDEN int NOT NULL.
 *
 * CLIENTE guarda el CODIGO de ruteo de CLIENTE_ASOC_RT (regla de oro del
 * modulo), NO el CLIENTE crudo del ERP ni de CLIENTE_RT.
 * DIA es el dia de la semana: 1=Lunes ... 7=Domingo.
 * Regla de negocio: un cliente NO puede repetirse en la misma ruta en mas
 * de un dia (ej Apple no puede pasar lunes Y viernes en la misma ruta); un
 * cliente solo tiene un dia asignado por ruta. Se valida en el controller
 * (la PK compuesta RUTA+CLIENTE+DIA no alcanza para esto sola).
 */
const RutaCliente = sequelize.define(
  "RUTA_CLIENTE",
  {
    RUTA: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo RUTA debe tener un maximo de 4 caracteres",
        },
      },
    },
    CLIENTE: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 20],
          msg: "El campo CLIENTE debe tener un maximo de 20 caracteres",
        },
      },
    },
    DIA: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      validate: {
        min: { args: [1], msg: "El campo DIA debe estar entre 1 y 7" },
        max: { args: [7], msg: "El campo DIA debe estar entre 1 y 7" },
      },
    },
    ORDEN: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = RutaCliente;
