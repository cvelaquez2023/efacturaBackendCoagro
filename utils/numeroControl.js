/**
 * Numero de control oficial (Hacienda) a partir del numero interno del DTE.
 *
 * Internamente el DTE lleva el año en medio; el oficial no:
 *   "DTE-03-M001P001-26-000000000008555" -> "DTE-03-M001P001-000000000008555"
 *
 * Se quita el año por POSICION (igual que config/MH.js, /dte/descargar y
 * envioMail), asi funciona con cualquier año. Antes se hacia con
 * replace("-26-", "-"), que solo servia para 2026.
 * Si el numero no trae año (formato viejo) se devuelve tal cual.
 */
const CON_ANO = /^DTE-\d{2}-.{8}-\d{2}-/;

const numeroControl = (dte) => {
  const d = String(dte ?? "").trim();
  return CON_ANO.test(d) ? d.substring(0, 15) + "-" + d.substring(19) : d;
};

module.exports = { numeroControl };
