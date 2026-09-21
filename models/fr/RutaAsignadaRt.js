const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Asigna una ruta (RUTA_RT) a un agente, un handheld, un grupo de articulos
 * y una bodega. Relacion 1:1: la PK real en BD (XPKRUTASIG) es solo RUTA,
 * asi que cada ruta tiene como maximo una fila de asignacion (confirmado
 * sept 2026 via sys.indexes; un supuesto anterior de PK compuesta/1:N
 * quedo descartado).
 *
 * Regla de oro del modulo: los campos "de ruteo" que referencian una entidad
 * con su propia tabla _ASOC_RT usan el CODIGO de esa _ASOC_RT, no la columna
 * cruda de la _RT. Por eso AGENTE valida contra AGENTE_ASOC_RT.CODIGO y
 * BODEGA contra BODEGA_ASOC_RT.CODIGO. HANDHELD y GRUPO_ARTICULO no tienen
 * tabla _ASOC_RT propia, asi que validan contra su _RT cruda
 * (HANDHELD_RT.HANDHELD y GRUPO_ARTICULO_RT.GRUPO_ARTICULO).
 *
 * Largos segun INFORMATION_SCHEMA real de erpadmin.RUTA_ASIGNADA_RT:
 * RUTA(4), COMPANIA(10), AGENTE(4), HANDHELD(4), ACTIVA(1), GRUPO_ARTICULO(3),
 * BODEGA(4). Todas NOT NULL en BD excepto COMPANIA (altarada a nullable via
 * ALTER TABLE, el sistema no maneja companias).
 */
const RutaAsignadaRt = sequelize.define(
  "RUTA_ASIGNADA_RT",
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
    AGENTE: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo AGENTE debe tener un maximo de 4 caracteres",
        },
      },
    },
    HANDHELD: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo HANDHELD debe tener un maximo de 4 caracteres",
        },
      },
    },
    GRUPO_ARTICULO: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        len: {
          args: [1, 3],
          msg: "El campo GRUPO_ARTICULO debe tener un maximo de 3 caracteres",
        },
      },
    },
    BODEGA: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo BODEGA debe tener un maximo de 4 caracteres",
        },
      },
    },
    // El sistema no maneja companias: siempre se guarda NULL.
    COMPANIA: {
      type: DataTypes.STRING(10),
      allowNull: true,
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
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = RutaAsignadaRt;
