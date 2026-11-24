//
// Flete por ruta: 4 columnas de erpadmin.RUTA_CONSECUT_RT (docs/fr-flete-ruta.sql).
// Lo usan /fr/rutaConsecutRt y /fr/fleteRuta para validar igual.
//
//   USA_FLETE      S/N   -> si la ruta cobra flete
//   MINIMO_FLETE   200   -> total del pedido CON descuentos y CON IVA por debajo del cual se cobra
//   MONTO_FLETE    3.50  -> precio SIN IVA de la linea de flete
//   ARTICULO_FLETE 103   -> articulo de Softland que se agrega como linea
//

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

const COLUMNAS_FLETE = ["USA_FLETE", "MINIMO_FLETE", "MONTO_FLETE", "ARTICULO_FLETE"];
// Defaults de la columna en BD (valores de Softland).
const ARTICULO_FLETE_DEFAULT = "103";

// USA_FLETE -> usaFlete
const campoJs = (columna) => columna.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

// Toma del body (camelCase) solo las columnas de flete que vienen.
const tomarFlete = (body) => {
  const valores = {};
  for (const columna of COLUMNAS_FLETE) {
    const valor = body[campoJs(columna)];
    if (valor !== undefined) valores[columna] = typeof valor === "string" ? valor.trim() : valor;
  }
  return valores;
};

const esNumero = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const esMontoPositivo = (v) => esNumero(v) && Number(v) > 0;

// Valida la fila FINAL (en un PUT: lo actual + los cambios). Devuelve un mensaje o null.
// Con USA_FLETE = 'S' son obligatorios minimo y monto (> 0) y el articulo debe existir en ARTICULO.
// Con 'N' los demas se guardan tal cual (la app los ignora).
// articulosExistentes (opcional): Set de COD_ART ya consultados, para no repetir la consulta en masivo.
const validarFlete = async (fila, articulosExistentes = null) => {
  const usa = fila.USA_FLETE === undefined || fila.USA_FLETE === null ? "N" : String(fila.USA_FLETE).trim();
  if (!["S", "N"].includes(usa)) return "El campo usaFlete debe ser S o N";
  for (const columna of ["MINIMO_FLETE", "MONTO_FLETE"]) {
    const v = fila[columna];
    if (v !== null && v !== undefined && v !== "" && !esNumero(v)) return `El campo ${campoJs(columna)} debe ser un monto`;
    if (esNumero(v) && Number(v) < 0) return `El campo ${campoJs(columna)} no puede ser negativo`;
  }
  const articulo = fila.ARTICULO_FLETE === undefined || fila.ARTICULO_FLETE === null
    ? ARTICULO_FLETE_DEFAULT
    : String(fila.ARTICULO_FLETE).trim();
  if (articulo.length > 20) return "El campo articuloFlete permite maximo 20 caracteres";
  if (usa !== "S") return null;

  if (!esMontoPositivo(fila.MINIMO_FLETE)) return "Con usaFlete = S, minimoFlete es obligatorio y mayor a 0";
  if (!esMontoPositivo(fila.MONTO_FLETE)) return "Con usaFlete = S, montoFlete es obligatorio y mayor a 0";
  if (!articulo) return "Con usaFlete = S, articuloFlete es obligatorio";

  if (articulosExistentes) {
    if (!articulosExistentes.has(articulo)) return `El articulo de flete ${articulo} no existe en ARTICULO`;
    return null;
  }
  const [existe] = await sequelize.query(
    `SELECT TOP 1 COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART = :articulo`,
    { replacements: { articulo }, type: QueryTypes.SELECT }
  );
  if (!existe) return `El articulo de flete ${articulo} no existe en ARTICULO`;
  return null;
};

module.exports = { COLUMNAS_FLETE, ARTICULO_FLETE_DEFAULT, tomarFlete, validarFlete };
