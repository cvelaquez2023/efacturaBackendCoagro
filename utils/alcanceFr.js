/**
 * Helpers compartidos por los CRUD de condiciones y promociones (fr).
 */
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const vacio = (v) => v === undefined || v === null || v === "";

// Acepta true/false, 1/0, "S"/"N". Devuelve "S"/"N" o undefined si no viene.
const toSN = (v) => {
  if (vacio(v)) return undefined;
  if (typeof v === "boolean") return v ? "S" : "N";
  return ["1", "S", "SI", "TRUE", "Y"].includes(String(v).trim().toUpperCase()) ? "S" : "N";
};

// Email del usuario web logueado (middleware/session deja el usuario en req.cliente).
const usuarioActual = (req) =>
  ((req.cliente && req.cliente[0] && req.cliente[0].email) || "web").slice(0, 50);

const existeArticulo = async (articulo) => {
  const [r] = await sequelize.query(
    `SELECT TOP 1 ARTICULO FROM CINCOH.ARTICULO WHERE ARTICULO = :articulo`,
    { replacements: { articulo }, type: QueryTypes.SELECT }
  );
  return !!r;
};

// Lineas = CINCOH.CLASIFICACION con AGRUPACION 3 (ARTICULO.CLASIFICACION_3).
const existeLinea = async (linea) => {
  const [r] = await sequelize.query(
    `SELECT TOP 1 CLASIFICACION FROM CINCOH.CLASIFICACION WHERE AGRUPACION = 3 AND CLASIFICACION = :linea`,
    { replacements: { linea }, type: QueryTypes.SELECT }
  );
  return !!r;
};

/**
 * Valida VALOR segun ALCANCE: A = articulo del ERP, L = linea (CLASIFICACION_3),
 * T = texto libre. Devuelve un mensaje de error o null.
 */
const validarAlcanceValor = async (alcance, valor, prefijo = "") => {
  if (alcance === "A" && !(await existeArticulo(valor))) {
    return `${prefijo}El articulo ${valor} no existe en el ERP`;
  }
  if (alcance === "L" && !(await existeLinea(valor))) {
    return `${prefijo}La linea ${valor} no existe (CLASIFICACION 3 del ERP)`;
  }
  return null;
};

module.exports = { vacio, toSN, usuarioActual, existeArticulo, existeLinea, validarAlcanceValor };
