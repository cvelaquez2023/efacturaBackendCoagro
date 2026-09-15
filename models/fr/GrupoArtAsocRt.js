const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Tabla intermedia (N:M) entre GRUPO_ARTICULO_RT y ARTICULO_RT.
 * Un articulo puede pertenecer a varios grupos y un grupo tiene varios
 * articulos.
 *
 * PK real en BD: probablemente (GRUPO_ARTICULO, COMPANIA, ARTICULO). Como el
 * sistema no maneja companias, se corre un ALTER TABLE que la deja en
 * (GRUPO_ARTICULO, ARTICULO) y hace COMPANIA nullable.
 */
const GrupoArtAsocRt = sequelize.define(
  "GRUPO_ART_ASOC_RT",
  {
    GRUPO_ARTICULO: {
      type: DataTypes.STRING(3),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 3],
          msg: "El campo GRUPO_ARTICULO debe tener un maximo de 3 caracteres",
        },
      },
    },
    ARTICULO: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 20],
          msg: "El campo ARTICULO debe tener un maximo de 20 caracteres",
        },
      },
    },
    // El sistema no maneja companias: siempre se guarda NULL.
    COMPANIA: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = GrupoArtAsocRt;
