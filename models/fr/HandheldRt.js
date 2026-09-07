const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const HandheldRt = sequelize.define(
  "HANDHELD_RT",
  {
    HANDHELD: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo HANDHELD debe tener un maximo de 4 caracteres",
        },
      },
    },
    DESCRIPCION: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: {
        len: {
          args: [1, 40],
          msg: "El campo DESCRIPCION debe tener un maximo de 40 caracteres",
        },
      },
    },
    SERIE: {
      type: DataTypes.STRING(15),
      validate: {
        len: {
          args: [0, 15],
          msg: "El campo SERIE debe tener un maximo de 15 caracteres",
        },
      },
    },
    MODELO: {
      type: DataTypes.STRING(15),
      validate: {
        len: {
          args: [0, 15],
          msg: "El campo MODELO debe tener un maximo de 15 caracteres",
        },
      },
    },
    ESTADO: {
      type: DataTypes.STRING(1),
      allowNull: false,
      validate: {
        len: {
          args: [1, 1],
          msg: "El campo ESTADO debe tener exactamente 1 caracter",
        },
      },
    },
    FIRMA: {
      type: DataTypes.STRING(2048),
      validate: {
        len: {
          args: [0, 2048],
          msg: "El campo FIRMA debe tener un maximo de 2048 caracteres",
        },
      },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = HandheldRt;
