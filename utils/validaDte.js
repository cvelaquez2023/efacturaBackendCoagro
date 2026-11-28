/**
 * Validación local de DTE y eventos contra los JSON Schemas oficiales del MH
 * (Normativa DTE v2.0). Los esquemas están en config/schemas/vN/.
 *
 * Modo (variable de entorno DTE_VALIDAR):
 *   "off"      -> no valida
 *   "log"      -> valida y registra los errores en el log (por defecto)
 *   "bloquear" -> igual que "log", y además valido=false debe detener el envío
 *                 (quien llama decide; ver firmaMH en config/MH.js)
 *
 * Si no hay esquema para el tipo y la versión (ej. FE versión 1, aún vigente
 * hasta el cambio), no valida y devuelve omitido=true.
 */
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const logger = require("./logger");

const DIR = path.join(__dirname, "..", "config", "schemas");

// clave "tipo:version" -> archivo
const ESQUEMAS = {
  "01:2": "v2/fe-f-v2.json",
  "03:4": "v4/fe-ccf-v4.json",
  "04:4": "v4/fe-nr-v4.json",
  "05:4": "v4/fe-nc-v4.json",
  "06:4": "v4/fe-nd-v4.json",
  "07:2": "v2/fe-cr-v2.json",
  "08:2": "v2/fe-cl-v2.json",
  "09:2": "v2/fe-dcl-v2.json",
  "11:3": "v3/fe-fex-v3.json",
  "14:2": "v2/fe-fse-v2.json",
  "15:2": "v2/fe-cd-v2.json",
  "invalidacion:3": "v3/invalidacion-schema-v3.json",
  "contingencia:4": "v4/contingencia-schema-v4.json",
  "retorno:1": "v1/fe-eret-v1.json",
  "operacionesEspeciales:1": "v1/fe-eop-v1.json",
};

// strict:false porque los esquemas del MH traen palabras clave no estándar
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Los esquemas MH usan multipleOf = 0.01 o 1e-8, que significa "máximo N
// decimales". El multipleOf estándar falla por punto flotante (33.33 "no es
// múltiplo de 1e-8"), así que se valida contando decimales.
ajv.removeKeyword("multipleOf");
ajv.addKeyword({
  keyword: "multipleOf",
  type: "number",
  schemaType: "number",
  errors: false,
  validate: (m, x) => {
    const dec = Math.round(-Math.log10(m));
    if (Math.abs(m - 10 ** -dec) < 1e-15) {
      return Number(x.toFixed(dec)) === x; // potencia de diez: máximo "dec" decimales
    }
    const q = x / m;
    return Math.abs(q - Math.round(q)) < 1e-9;
  },
});

const cache = {};
const compilar = (clave) => {
  if (cache[clave]) return cache[clave];
  const archivo = ESQUEMAS[clave];
  if (!archivo) return null;
  const texto = fs
    .readFileSync(path.join(DIR, archivo), "utf8")
    .replace(/^﻿/, "");
  cache[clave] = ajv.compile(JSON.parse(texto));
  return cache[clave];
};

// Deduce el tipo de documento a partir del propio JSON
const tipoDe = (json) => {
  if (json?.identificacion?.tipoDte) return json.identificacion.tipoDte;
  if (json?.detalleDTE) return "contingencia";
  if (json?.documento && json?.motivo) return "invalidacion";
  return null;
};

const formatear = (e) => {
  const ruta = e.instancePath || "(raíz)";
  if (e.keyword === "additionalProperties")
    return `${ruta}: campo no permitido "${e.params.additionalProperty}"`;
  if (e.keyword === "required")
    return `${ruta}: falta "${e.params.missingProperty}"`;
  return `${ruta}: ${e.message}`;
};

// Reglas que Hacienda aplica en su servidor y no vienen en el esquema JSON.
// Rechazo real (2026-11-27): "#/emisor/codEstableMH no cumple el formato
// requerido" con "0001"; exige el formato del número de control (S028 / P001).
const reglasExtraMH = (json, tipo) => {
  const errores = [];

  // DTE: DUI del receptor (CAT-022 "13") en v2 = 9 dígitos sin guion.
  // Rechazo real (2026-11-27, FE v2): "04189757-1" -> "#/receptor/numDocumento
  // no cumple el formato requerido".
  const rec = json?.receptor;
  if (rec && rec.tipoDocumento === "13" && !/^[0-9]{9}$/.test(String(rec.numDocumento ?? ""))) {
    errores.push(`/receptor/numDocumento: DUI "${rec.numDocumento}" debe ir con 9 dígitos sin guion`);
  }

  if (tipo !== "invalidacion" && tipo !== "contingencia") return errores;
  const e = json?.emisor || {};
  const revisar = (campo, formato, ejemplo) => {
    const v = e[campo];
    if (v === null && tipo === "contingencia") return;
    if (!formato.test(String(v ?? ""))) {
      errores.push(`/emisor/${campo}: "${v}" no cumple el formato MH (ej. ${ejemplo})`);
    }
  };
  revisar("codEstableMH", /^[MBSP][0-9]{3}$/, "S028");
  revisar("codPuntoVentaMH", /^P[0-9]{3}$/, "P001");
  return errores;
};

/**
 * @param {object} json  DTE o evento sin firmar
 * @param {object} [opc] { tipo, version, ref }  ref = texto para el log (factura, etc.)
 * @returns {{valido:boolean, omitido:boolean, errores:string[]}}
 */
const validaDte = (json, opc = {}) => {
  const modo = (process.env.DTE_VALIDAR || "log").toLowerCase();
  if (modo === "off") return { valido: true, omitido: true, errores: [] };

  const tipo = opc.tipo || tipoDe(json);
  const version = opc.version ?? json?.identificacion?.version;
  const clave = `${tipo}:${version}`;
  const ref = opc.ref ? ` ${opc.ref}` : "";

  try {
    const validar = compilar(clave);
    if (!validar) {
      logger.debug(`Sin esquema para ${clave}${ref}; no se valida`, {
        controller: "validaDte",
      });
      return { valido: true, omitido: true, errores: [] };
    }
    const errores = validar(json) ? [] : validar.errors.map(formatear);
    errores.push(...reglasExtraMH(json, tipo));
    if (errores.length === 0) return { valido: true, omitido: false, errores: [] };

    logger.warn(
      `DTE ${clave}${ref} no cumple el esquema MH (${errores.length}): ${errores.join(" | ")}`,
      { controller: "validaDte" }
    );
    return { valido: false, omitido: false, errores };
  } catch (error) {
    // Un fallo del validador nunca debe frenar la facturación
    logger.error(`Error validando ${clave}${ref}: ${error.message}`, {
      controller: "validaDte",
    });
    return { valido: true, omitido: true, errores: [] };
  }
};

module.exports = { validaDte, ESQUEMAS };
