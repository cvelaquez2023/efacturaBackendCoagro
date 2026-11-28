/**
 * Datos adicionales de la Normativa DTE v2.0 para las representaciones
 * gráficas (PDF). Solo agrega información; no cambia el formato.
 *
 * - ubicacion(): "Distrito, Municipio" a partir de los códigos MH guardados
 *   en dte.dbo.emisor / receptor / subjetoExcluido (direccion_depa,
 *   direccion_dist). Documentos v1 no tienen distrito -> "" y el PDF no
 *   muestra la línea.
 * - apendiceExtra(): apéndices que el PDF aún no mostraba.
 */
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");

const limpio = (v) => (v === null || v === undefined ? "" : String(v).trim());

const ubicacion = async (depa, dist) => {
  const d = limpio(depa);
  const t = limpio(dist);
  if (!d || !t || d === "ND") return "";
  try {
    const [fila] = await sequelize.query(
      `SELECT TOP 1
              LTRIM(RTRIM(REPLACE(D3.NOMBRE, CHAR(160), ' '))) AS distrito,
              LTRIM(RTRIM(REPLACE(D2.NOMBRE, CHAR(160), ' '))) AS municipio
         FROM COAGRO2.erpadmin.DIVISION_GEOGRAFICA3 D3
         LEFT JOIN COAGRO2.erpadmin.DIVISION_GEOGRAFICA2 D2
                ON D2.PAIS = D3.PAIS
               AND D2.DIVISION_GEOGRAFICA1 = D3.DIVISION_GEOGRAFICA1
               AND D2.DIVISION_GEOGRAFICA2 = D3.DIVISION_GEOGRAFICA2
        WHERE D3.PAIS = 'ESA'
          AND LTRIM(RTRIM(D3.DIVISION_GEOGRAFICA1)) = :depa
          AND LTRIM(RTRIM(D3.DIVISION_GEOGRAFICA3)) = :dist`,
      { replacements: { depa: d, dist: d + t }, type: QueryTypes.SELECT }
    );
    if (!fila) return "";
    return [fila.distrito, fila.municipio].filter(Boolean).join(", ");
  } catch (error) {
    return ""; // nunca frenar el PDF por esto
  }
};

// Ya se muestran en otro lugar del PDF (o tienen su propia línea)
const YA_MOSTRADOS = ["VENDEDOR", "CLIENTE", "OBSERVACIONES"];
const VACIOS = ["", "ND", "NODEFINDO", "NULL", "UNDEFINED"];
const ETIQUETAS = {
  NOMBRE: "NOMBRE VENDEDOR",
  PAGO: "CONDICIÓN DE PAGO",
  DESCRIPCION: "DESCRIPCIÓN",
  PEDIDO: "PEDIDO",
  DIRECION: "DIRECCIÓN DE ENTREGA",
  ALIAS: "ALIAS",
  ZONA: "ZONA",
};

// excluir: campos que esa plantilla ya imprime aparte (además de YA_MOSTRADOS)
const apendiceExtra = (apendice = [], excluir = []) =>
  apendice
    .filter((a) => ![...YA_MOSTRADOS, ...excluir].includes(limpio(a.campo).toUpperCase()))
    .filter((a) => !VACIOS.includes(limpio(a.valor).toUpperCase()))
    .map((a) => ({
      etiqueta: ETIQUETAS[limpio(a.campo).toUpperCase()] || limpio(a.etiqueta) || limpio(a.campo),
      valor: limpio(a.valor),
    }));

// Observaciones sin el relleno "ND"
const observacionesPdf = (valor) => {
  const v = limpio(valor);
  return VACIOS.includes(v.toUpperCase()) ? "" : v;
};

module.exports = { ubicacion, apendiceExtra, observacionesPdf };
