const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

// Largo de HANDHELD_RT.FIRMA (varchar 2048).
const FIRMA_MAX = 2048;

const normalizarFirma = (firma) => String(firma ?? "").trim();

/**
 * Valida la handheld de la app movil y devuelve sus rutas activas.
 *
 * La ruta NO la elige la app: sale de RUTA_ASIGNADA_RT (HANDHELD -> RUTA, AGENTE,
 * BODEGA, GRUPO_ARTICULO). La PK de esa tabla es solo RUTA, asi que una handheld
 * puede tener varias rutas.
 *
 * RUTA_ASIGNADA_RT.BODEGA es el CODIGO de ruteo (BODEGA_ASOC_RT.CODIGO), que
 * puede ser un alias distinto a la bodega del ERP (ej. CLI1 -> 10). Cada ruta
 * trae tambien BODEGA_ERP (BODEGA_ASOC_RT.BODEGA), que es el codigo que usan
 * ARTICULO_EXISTENCIA y el resto de tablas del ERP.
 *
 * Firma del dispositivo: HANDHELD_RT.FIRMA liga la handheld a UN solo equipo
 * (el identificador que manda la app). Los usuarios no se ligan a la handheld.
 *  - FIRMA vacia + vincular: la handheld queda ligada a esta firma (primer
 *    registro/login del equipo). El UPDATE solo aplica si sigue vacia, asi dos
 *    equipos a la vez no pueden quedarse con la misma handheld.
 *  - FIRMA vacia sin vincular (sesion): error, el equipo debe volver a hacer login.
 *  - FIRMA distinta: error, la handheld es de otro equipo. Para cambiar de equipo
 *    el Admin la libera con PUT /fr/handheldRt/:handheld/liberar.
 *
 * @param {string} codigo   codigo de la handheld (HANDHELD_RT.HANDHELD)
 * @param {{ firma: string, vincular?: boolean }} opciones
 * @returns {{ error: string } | { handheld: object, rutas: object[] }}
 */
const resolverHandheld = async (codigo, { firma, vincular = false } = {}) => {
  const handheld = String(codigo || "").trim();
  if (!handheld) return { error: "Falta el codigo de la handheld" };

  const firmaEquipo = normalizarFirma(firma);
  if (!firmaEquipo) return { error: "Falta la firma del dispositivo" };
  if (firmaEquipo.length > FIRMA_MAX) {
    return { error: `La firma del dispositivo debe tener un maximo de ${FIRMA_MAX} caracteres` };
  }

  const buscar = async () => {
    const [fila] = await sequelize.query(
      `SELECT HANDHELD, DESCRIPCION, ESTADO, FIRMA FROM COAGRO2.erpadmin.HANDHELD_RT WHERE HANDHELD = :handheld`,
      { replacements: { handheld }, type: QueryTypes.SELECT }
    );
    return fila;
  };

  let hh = await buscar();
  if (!hh) return { error: `La handheld ${handheld} no esta registrada en el sistema` };
  if (hh.ESTADO !== "A") return { error: `La handheld ${handheld} no esta activa` };

  if (!normalizarFirma(hh.FIRMA) && vincular) {
    await sequelize.query(
      `UPDATE COAGRO2.erpadmin.HANDHELD_RT SET FIRMA = :firma
        WHERE HANDHELD = :handheld AND (FIRMA IS NULL OR LTRIM(RTRIM(FIRMA)) = '')`,
      { replacements: { firma: firmaEquipo, handheld: hh.HANDHELD }, type: QueryTypes.UPDATE }
    );
    hh = await buscar();
  }

  const firmaHandheld = normalizarFirma(hh.FIRMA);
  if (!firmaHandheld) {
    return { error: `La handheld ${handheld} no esta vinculada a este dispositivo, vuelve a iniciar sesion` };
  }
  if (firmaHandheld !== firmaEquipo) {
    return {
      error: `La handheld ${handheld} ya esta vinculada a otro dispositivo. Pide a un administrador que la libere.`,
    };
  }

  const rutas = await sequelize.query(
    `SELECT a.RUTA, r.DESCRIPCION, a.AGENTE, a.BODEGA, ba.BODEGA AS BODEGA_ERP, a.GRUPO_ARTICULO
       FROM COAGRO2.erpadmin.RUTA_ASIGNADA_RT a
       LEFT JOIN COAGRO2.erpadmin.RUTA_RT r ON r.RUTA = a.RUTA
       LEFT JOIN COAGRO2.erpadmin.BODEGA_ASOC_RT ba ON ba.CODIGO = a.BODEGA
      WHERE a.HANDHELD = :handheld AND a.ACTIVA = 'S'
      ORDER BY a.RUTA`,
    { replacements: { handheld: hh.HANDHELD }, type: QueryTypes.SELECT }
  );
  if (!rutas.length) {
    return { error: `La handheld ${handheld} no tiene una ruta activa asignada` };
  }

  return {
    handheld: { HANDHELD: hh.HANDHELD, DESCRIPCION: hh.DESCRIPCION },
    firma: firmaHandheld,
    rutas,
  };
};

module.exports = { resolverHandheld };
