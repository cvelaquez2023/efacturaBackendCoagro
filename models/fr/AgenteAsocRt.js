const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Tabla de asociacion 1:1 entre el agente/vendedor del ERP (AGENTE_RT) y el
 * codigo propio del sistema de ruteo. Ej: AGENTE "10" (ERP) -> CODIGO "CLI1"
 * (ruteo). Ni el AGENTE ni el CODIGO se repiten (validado en el controller).
 *
 * PK real en BD: (AGENTE, CODIGO, COMPANIA). Como el sistema no maneja
 * companias, hay un ALTER TABLE pendiente que la deja en (AGENTE, CODIGO) y
 * hace COMPANIA nullable (mismo tratamiento que GRUPO_ART_ASOC_RT y
 * BODEGA_ASOC_RT).
 *
 * Largos segun INFORMATION_SCHEMA de erpadmin.AGENTE_ASOC_RT:
 * AGENTE(4), COMPANIA(10), CODIGO(4), TIPO(1). Las 4 columnas son NOT NULL
 * en BD (TIPO es obligatorio, valor libre sin catalogo fijo).
 */
const AgenteAsocRt = sequelize.define(
  "AGENTE_ASOC_RT",
  {
    AGENTE: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo AGENTE debe tener un maximo de 4 caracteres",
        },
      },
    },
    CODIGO: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo CODIGO debe tener un maximo de 4 caracteres",
        },
      },
    },
    // El sistema no maneja companias: siempre se guarda NULL.
    COMPANIA: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Valor libre (sin catalogo fijo), obligatorio en BD.
    TIPO: {
      type: DataTypes.STRING(1),
      allowNull: false,
      validate: {
        len: {
          args: [1, 1],
          msg: "El campo TIPO debe tener 1 caracter",
        },
      },
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = AgenteAsocRt;
