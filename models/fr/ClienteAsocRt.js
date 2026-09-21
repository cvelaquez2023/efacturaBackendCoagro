const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Tabla de asociacion 1:1 entre el cliente del modulo de rutas (CLIENTE_RT)
 * y el codigo propio del sistema de ruteo, mas la bodega y localizacion de
 * consigna. Ej: CLIENTE "C01" (ya registrado en CLIENTE_RT) -> CODIGO
 * "CLI01" (ruteo).
 *
 * PK real en BD: solo CODIGO (a diferencia de BODEGA_ASOC_RT, aqui CLIENTE
 * y COMPANIA NO son parte de la PK, y no hubo que correr ningun ALTER).
 * CLIENTE no tiene restriccion de unicidad en BD: la relacion 1:1 (un
 * cliente = un solo codigo) se valida en el controller.
 *
 * Largos segun INFORMATION_SCHEMA de erpadmin.CLIENTE_ASOC_RT:
 * CLIENTE(20), COMPANIA(10), CODIGO(20), BODEGA_CONSIGNA(4),
 * LOCALIZACION_CONSIGNA(8).
 */
const ClienteAsocRt = sequelize.define(
  "CLIENTE_ASOC_RT",
  {
    CODIGO: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      validate: {
        len: {
          args: [1, 20],
          msg: "El campo CODIGO debe tener un maximo de 20 caracteres",
        },
      },
    },
    // FK logica a CLIENTE_RT.CLIENTE.
    CLIENTE: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        len: {
          args: [1, 20],
          msg: "El campo CLIENTE debe tener un maximo de 20 caracteres",
        },
      },
    },
    // El sistema no maneja companias: siempre se guarda NULL.
    COMPANIA: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Guarda el CODIGO de ruteo de BODEGA_ASOC_RT (NO el BODEGA crudo del
    // ERP, ni BODEGA_RT.BODEGA): solo se pueden usar bodegas que ya tienen
    // un codigo de ruteo asignado.
    BODEGA_CONSIGNA: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    LOCALIZACION_CONSIGNA: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = ClienteAsocRt;
