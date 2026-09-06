const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

const ArticuloRt = sequelize.define(
  "ARTICULO_RT",
  {
    // El sistema no maneja companias: siempre se guarda NULL.
    COMPANIA: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: {
          args: [0, 10],
          msg: "El campo COMPANIA debe tener un maximo de 10 caracteres",
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
    DESCRIPCION: {
      type: DataTypes.STRING(254),
      allowNull: false,
      validate: {
        len: {
          args: [1, 254],
          msg: "El campo DESCRIPCION debe tener un maximo de 254 caracteres",
        },
      },
    },
    // Grupo al que pertenece el articulo (FK a GRUPO_ARTICULO_RT).
    // DESCOMENTAR cuando se corra el ALTER TABLE que agrega la columna
    // GRUPO_ARTICULO char(3) a erpadmin.ARTICULO_RT.
    // GRUPO_ARTICULO: {
    //   type: DataTypes.STRING(3),
    //   allowNull: true,
    //   validate: {
    //     len: {
    //       args: [0, 3],
    //       msg: "El campo GRUPO_ARTICULO debe tener un maximo de 3 caracteres",
    //     },
    //   },
    // },
    FACTOR_PRECIO: {
      type: DataTypes.DECIMAL(38, 8),
      allowNull: false,
    },
    ORDEN_ARTICULO: {
      type: DataTypes.STRING(5),
      validate: {
        len: {
          args: [0, 5],
          msg: "El campo ORDEN_ARTICULO debe tener un maximo de 5 caracteres",
        },
      },
    },
    BODEGA: {
      type: DataTypes.STRING(4),
      validate: {
        len: {
          args: [0, 4],
          msg: "El campo BODEGA debe tener un maximo de 4 caracteres",
        },
      },
    },
    LOCALIZACION: {
      type: DataTypes.STRING(4),
      validate: {
        len: {
          args: [0, 4],
          msg: "El campo LOCALIZACION debe tener un maximo de 4 caracteres",
        },
      },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = ArticuloRt;
