const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Tabla de asociacion 1:1 entre la bodega del ERP (BODEGA_RT) y el codigo
 * propio del sistema de ruteo. Ej: BODEGA "C01" (ERP) -> CODIGO "CLI01"
 * (ruteo). Ni la BODEGA ni el CODIGO se repiten (validado en el controller).
 *
 * PK real en BD: (BODEGA, CODIGO, COMPANIA). Como el sistema no maneja
 * companias, hay un ALTER TABLE pendiente que la deja en (BODEGA, CODIGO) y
 * hace COMPANIA nullable (mismo tratamiento que GRUPO_ART_ASOC_RT).
 *
 * Largos segun INFORMATION_SCHEMA de erpadmin.BODEGA_ASOC_RT:
 * BODEGA(4), CODIGO(4), COMPANIA(10), CODIGO_BODEGA_RETABLECER(4),
 * PAQUETE_INVENTARIO(4), CONSECUTIVO_CI(10), LOCALIZACION(8).
 */
const BodegaAsocRt = sequelize.define(
  "BODEGA_ASOC_RT",
  {
    BODEGA: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 4],
          msg: "El campo BODEGA debe tener un maximo de 4 caracteres",
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
    // Flag S/N: "S" = el CODIGO debe ser igual a BODEGA (se usa el mismo
    // codigo del ERP, sin alias). "N" = CODIGO es propio/distinto (alias).
    // Coherencia (CODIGO_BODEGA_RETABLECER="S" => CODIGO===BODEGA) validada
    // en el controller, no aqui. Ver PUT /fr/bodegaAsocRt/:bodega/restablecer.
    CODIGO_BODEGA_RETABLECER: {
      type: DataTypes.STRING(4),
      allowNull: true,
      validate: {
        isIn: {
          args: [["S", "N"]],
          msg: "El campo CODIGO_BODEGA_RETABLECER debe ser S o N",
        },
      },
    },
    // Flag S/N.
    PAQUETE_INVENTARIO: {
      type: DataTypes.STRING(4),
      allowNull: true,
      validate: {
        isIn: {
          args: [["S", "N"]],
          msg: "El campo PAQUETE_INVENTARIO debe ser S o N",
        },
      },
    },
    // CONSECUTIVO de CINCOH.CONSECUTIVO_CI (ver ConsecutivoCiErp).
    CONSECUTIVO_CI: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    LOCALIZACION: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = BodegaAsocRt;
