const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");

/**
 * Parametros de la app movil por handheld: una fila por (HANDHELD, CONSTANTE),
 * con su VALOR y el resto de columnas de configuracion. La app los descarga con
 * GET /fr/sync/configuracion.
 *
 * Largos/tipos segun INFORMATION_SCHEMA real de [COAGRO2].erpadmin.CONFIG_HH
 * (confirmado nov 2026). PK real (PKCONFIG_HH): HANDHELD + CONSTANTE, ambas
 * NOT NULL; el resto es nullable. No tiene columna COMPANIA.
 * Los char(1) son banderas sin catalogo fijo: solo se valida el largo.
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

const campoEntero = (nombre) => ({
  type: DataTypes.INTEGER,
  allowNull: true,
  validate: { isInt: { msg: `El campo ${nombre} debe ser un numero entero` } },
});

// bit en BD: true/false (acepta tambien 1/0).
const campoBit = () => ({
  type: DataTypes.BOOLEAN,
  allowNull: true,
});

const ConfigHh = sequelize.define(
  "CONFIG_HH",
  {
    HANDHELD: { ...campoTexto("HANDHELD", 4, { allowNull: false }), primaryKey: true },
    CONSTANTE: { ...campoTexto("CONSTANTE", 50, { allowNull: false }), primaryKey: true },
    VALOR: campoTexto("VALOR", 50),
    SIMBOLO_MONEDA: campoTexto("SIMBOLO_MONEDA", 5),
    NOMBRE_ARCHIVO_BITACORA: campoTexto("NOMBRE_ARCHIVO_BITACORA", 100),
    REGISTRO_MULTIPLE_DOCUMENTO: campoTexto("REGISTRO_MULTIPLE_DOCUMENTO", 2),
    CANTIDAD_DECIMALES: campoEntero("CANTIDAD_DECIMALES"),
    TAMANO_LETRA_WM: campoEntero("TAMANO_LETRA_WM"),
    DECIMALES_UNIDADES: campoEntero("DECIMALES_UNIDADES"),
    LIMPIADO_FILTRO_ARTICULOS_ANDROID: campoTexto("LIMPIADO_FILTRO_ARTICULOS_ANDROID", 1),
    INFORMACION_DESCUENTOS_VENCIDA: campoTexto("INFORMACION_DESCUENTOS_VENCIDA", 1),
    SELECCION_AUTOMATICA_CLIENTE_WM: campoTexto("SELECCION_AUTOMATICA_CLIENTE_WM", 1),
    BUSQUEDA_AGIL_CLIENTE_WM: campoTexto("BUSQUEDA_AGIL_CLIENTE_WM", 1),
    ORDENAR_ARTICULO_CRITERIO_WM: campoTexto("ORDENAR_ARTICULO_CRITERIO_WM", 1),
    ORDENAR_ARTICULO_INDICE_WM: campoTexto("ORDENAR_ARTICULO_INDICE_WM", 1),
    ADVERTIR_ACTUALIZACION: campoTexto("ADVERTIR_ACTUALIZACION", 1),
    PURGA_AUTOMATICA: campoTexto("PURGA_AUTOMATICA", 1),
    PURGA_MANUAL: campoTexto("PURGA_MANUAL", 1),
    PURGA_CANTIDAD_DIAS: campoEntero("PURGA_CANTIDAD_DIAS"),
    GPS_UBICACION_VISITA: campoBit(),
    GPS_UBICACION_CLIENTE: campoBit(),
    GPS_ACTUALIZAR_UBICACION_CLIENTE: campoBit(),
    GPS_NO_DETENER_PROCESO_WM: campoBit(),
    GPS_DISTANCIA_M: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: { isDecimal: { msg: "El campo GPS_DISTANCIA_M debe ser numerico" } },
    },
  },
  {
    schema: "ERPADMIN",
    tableName: "CONFIG_HH",
    timestamps: false,
  }
);

module.exports = ConfigHh;
