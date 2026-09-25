const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Configuracion de consecutivos/NCF por ruta: que codigo de documento y que
 * comprobante fiscal (NCF) usa cada ruta para pedido, recibo, devolucion,
 * factura, inventario, notas de credito/debito, etc, mas los datos de
 * facturacion electronica (SUBTIPO_ y DTE_) de cada tipo de documento.
 *
 * Largos segun INFORMATION_SCHEMA real de [COAGRO2].erpadmin.RUTA_CONSECUT_RT
 * (confirmado sept 2026). PK real en BD (XPKRUTACONSEC): RUTA + COMPANIA,
 * ambas NOT NULL. Mismo tratamiento que el resto del modulo: el sistema no
 * maneja companias, COMPANIA se guarda siempre null. ALTER TABLE pendiente
 * (el usuario lo corre cuando confirme el flujo) para sacar COMPANIA de la
 * PK (PK nueva = solo RUTA) y volverla nullable:
 *   ALTER TABLE erpadmin.RUTA_CONSECUT_RT DROP CONSTRAINT XPKRUTACONSEC;
 *   ALTER TABLE erpadmin.RUTA_CONSECUT_RT ALTER COLUMN COMPANIA varchar(20) NULL;
 *   ALTER TABLE erpadmin.RUTA_CONSECUT_RT ADD CONSTRAINT XPKRUTACONSEC PRIMARY KEY (RUTA);
 * Hasta que corra ese ALTER, el INSERT con COMPANIA=null truena (la columna
 * sigue NOT NULL en BD).
 *
 * NCF_DEVOCULION_SEC conserva el typo tal cual esta en la columna real de BD
 * (no es DEVOLUCION), no corregir sin que el cliente lo pida.
 *
 * Los campos "codigo de documento" o NCF (PEDIDO, RECIBO, NCF_, etc) y los
 * SUBTIPO_ y DTE_ son texto libre por ahora (sin FK ni catalogo fijo,
 * confirmado con el cliente sept 2026) -- solo se valida tipo/largo.
 */
const campoTexto = (nombre, maxLen, { allowNull = true } = {}) => ({
  type: DataTypes.STRING(maxLen),
  allowNull,
  validate: {
    len: {
      args: [allowNull ? 0 : 1, maxLen],
      msg: `El campo ${nombre} debe tener un maximo de ${maxLen} caracteres`,
    },
  },
});

const campoEntero = () => ({
  type: DataTypes.INTEGER,
  allowNull: true,
});

const RutaConsecutRt = sequelize.define(
  "RUTA_CONSECUT_RT",
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
    // El sistema no maneja companias: siempre se guarda NULL (ver ALTER pendiente arriba).
    COMPANIA: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    PEDIDO: campoTexto("PEDIDO", 50, { allowNull: false }),
    RECIBO: campoTexto("RECIBO", 50, { allowNull: false }),
    DEVOLUCION: campoTexto("DEVOLUCION", 50, { allowNull: false }),
    FACTURA: campoTexto("FACTURA", 50, { allowNull: false }),
    INVENTARIO: campoTexto("INVENTARIO", 20, { allowNull: false }),
    PEDIDO_DESCUENTO: campoTexto("PEDIDO_DESCUENTO", 50, { allowNull: false }),
    NOTACREDITO: campoTexto("NOTACREDITO", 20),
    NCF_CONSUMIDOR_F: campoTexto("NCF_CONSUMIDOR_F", 20),
    NCF_ORGANIZADO: campoTexto("NCF_ORGANIZADO", 20),
    NCF_REGIMEN_ESP: campoTexto("NCF_REGIMEN_ESP", 20),
    NCF_GUBERNAMENTAL: campoTexto("NCF_GUBERNAMENTAL", 20),
    NCF_DEVOLUCION: campoTexto("NCF_DEVOLUCION", 20),
    NCF_RECIBO: campoTexto("NCF_RECIBO", 20),
    GARANTIA: campoTexto("GARANTIA", 20),
    CONSEC_RESOLUCION_FAC: campoTexto("CONSEC_RESOLUCION_FAC", 20),
    CONSEC_RESOLUCION_DEV: campoTexto("CONSEC_RESOLUCION_DEV", 20),
    NCF_CONSUMIDOR_F_SEC: campoEntero(),
    NCF_ORGANIZADO_SEC: campoEntero(),
    NCF_REGIMEN_ESP_SEC: campoEntero(),
    NCF_GUBERNAMENTAL_SEC: campoEntero(),
    NCF_DEVOCULION_SEC: campoEntero(),
    NCF_RECIBO_SEC: campoEntero(),
    OTROCREDITO: campoTexto("OTROCREDITO", 20),
    NCF_FACTURA_EXP: campoTexto("NCF_FACTURA_EXP", 20),
    NCF_FACTURA_EXP_SEC: campoEntero(),
    NCF_CONTING_CRDT_FISCAL: campoTexto("NCF_CONTING_CRDT_FISCAL", 20),
    NCF_CONTING_CRDT_FISCAL_SEC: campoEntero(),
    NCF_CONTING_CONSUMO: campoTexto("NCF_CONTING_CONSUMO", 20),
    NCF_CONTING_CONSUMO_SEC: campoEntero(),
    NCF_CONTING_GUBERNAMENTAL: campoTexto("NCF_CONTING_GUBERNAMENTAL", 20),
    NCF_CONTING_GUBERNAMENTAL_SEC: campoEntero(),
    NCF_CONTING_REGIMEN_ESP: campoTexto("NCF_CONTING_REGIMEN_ESP", 20),
    NCF_CONTING_REGIMEN_ESP_SEC: campoEntero(),
    NCF_CONTING_DEVOLUCION: campoTexto("NCF_CONTING_DEVOLUCION", 20),
    NCF_CONTING_DEVOLUCION_SEC: campoEntero(),
    NCF_CONTING_FACTURA_EXP: campoTexto("NCF_CONTING_FACTURA_EXP", 20),
    NCF_CONTING_FACTURA_EXP_SEC: campoEntero(),
    CREDITO_FISCAL: campoTexto("CREDITO_FISCAL", 50),
    SUBTIPO_CREDITO_FISCAL: campoTexto("SUBTIPO_CREDITO_FISCAL", 28),
    DTE_CREDITO_FISCAL: campoTexto("DTE_CREDITO_FISCAL", 100),
    FACTURA_EXPORTACION: campoTexto("FACTURA_EXPORTACION", 50),
    SUBTIPO_FACTURA_EXPORTACION: campoTexto("SUBTIPO_FACTURA_EXPORTACION", 28),
    DTE_FACTURA_EXPORTACION: campoTexto("DTE_FACTURA_EXPORTACION", 100),
    SUBTIPO_FACTURA: campoTexto("SUBTIPO_FACTURA", 28),
    DTE_FACTURA: campoTexto("DTE_FACTURA", 100),
    SUBTIPO_DEVOLUCION: campoTexto("SUBTIPO_DEVOLUCION", 28),
    DTE_DEVOLUCION: campoTexto("DTE_DEVOLUCION", 100),
    SUBTIPO_DEVOLUCION_ANULACION: campoTexto("SUBTIPO_DEVOLUCION_ANULACION", 28),
    DEVOLUCION_ANULACION: campoTexto("DEVOLUCION_ANULACION", 50),
    DTE_DEVOLUCION_ANULACION: campoTexto("DTE_DEVOLUCION_ANULACION", 100),
    SUBTIPO_NOTA_CREDITO: campoTexto("SUBTIPO_NOTA_CREDITO", 28),
    DTE_NOTA_CREDITO: campoTexto("DTE_NOTA_CREDITO", 100),
    SUBTIPO_OTRO_CREDITO: campoTexto("SUBTIPO_OTRO_CREDITO", 28),
    DTE_OTRO_CREDITO: campoTexto("DTE_OTRO_CREDITO", 100),
  },
  {
    schema: "ERPADMIN",
    timestamps: false,
  }
);

module.exports = RutaConsecutRt;
