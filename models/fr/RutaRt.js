const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const RutaRt = sequelize.define(
  "RUTA_RT",
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
    ACTIVA: {
      type: DataTypes.STRING(1),
      allowNull: false,
      validate: {
        len: {
          args: [1, 1],
          msg: "El campo ACTIVA debe tener exactamente 1 caracter",
        },
      },
    },
    PERIODICIDAD: {
      type: DataTypes.STRING(1),
      allowNull: false,
      validate: {
        len: {
          args: [1, 1],
          msg: "El campo PERIODICIDAD debe tener exactamente 1 caracter",
        },
      },
    },
    GRUPO_TELEFONO: {
      type: DataTypes.STRING(4),
      validate: {
        len: {
          args: [0, 4],
          msg: "El campo GRUPO_TELEFONO debe tener un maximo de 4 caracteres",
        },
      },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = RutaRt;
