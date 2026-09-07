const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const GrupoArticuloRt = sequelize.define(
  "GRUPO_ARTICULO_RT",
  {
    GRUPO_ARTICULO: {
      type: DataTypes.STRING(3),
      primaryKey: true,
      validate: {
        len: {
          args: [1, 3],
          msg: "El campo GRUPO_ARTICULO debe tener un maximo de 3 caracteres",
        },
      },
    },
    DESCRIPCION: { type: DataTypes.STRING },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = GrupoArticuloRt;
