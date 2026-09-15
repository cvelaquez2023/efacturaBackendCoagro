const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const ClienteRt = sequelize.define(
  "CLIENTE_RT",
  {
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
    NOMBRE: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: {
          args: [1, 150],
          msg: "El campo NOMBRE debe tener un maximo de 150 caracteres",
        },
      },
    },
    LATITUD: { type: DataTypes.DECIMAL(28, 8) },
    LONGITUD: { type: DataTypes.DECIMAL(28, 8) },
    ALTITUD: { type: DataTypes.DECIMAL(28, 8) },
    FECHA_ACTUALIZACION_UBICACION: { type: DataTypes.DATE },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = ClienteRt;
