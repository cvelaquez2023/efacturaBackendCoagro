const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");

/**
 * Valida la handheld de la app movil y devuelve sus rutas activas.
 *
 * La ruta NO la elige la app: sale de RUTA_ASIGNADA_RT (HANDHELD -> RUTA, AGENTE,
 * BODEGA, GRUPO_ARTICULO). La PK de esa tabla es solo RUTA, asi que una handheld
 * puede tener varias rutas.
 *
 * @returns {{ error: string } | { handheld: object, rutas: object[] }}
 */
const resolverHandheld = async (codigo) => {
  const handheld = String(codigo || "").trim();
  if (!handheld) return { error: "Falta el codigo de la handheld" };

  const [hh] = await sequelize.query(
    `SELECT HANDHELD, DESCRIPCION, ESTADO FROM COAGRO2.erpadmin.HANDHELD_RT WHERE HANDHELD = :handheld`,
    { replacements: { handheld }, type: QueryTypes.SELECT }
  );
  if (!hh) return { error: `La handheld ${handheld} no esta registrada en el sistema` };
  if (hh.ESTADO !== "A") return { error: `La handheld ${handheld} no esta activa` };

  const rutas = await sequelize.query(
    `SELECT a.RUTA, r.DESCRIPCION, a.AGENTE, a.BODEGA, a.GRUPO_ARTICULO
       FROM COAGRO2.erpadmin.RUTA_ASIGNADA_RT a
       LEFT JOIN COAGRO2.erpadmin.RUTA_RT r ON r.RUTA = a.RUTA
      WHERE a.HANDHELD = :handheld AND a.ACTIVA = 'S'
      ORDER BY a.RUTA`,
    { replacements: { handheld: hh.HANDHELD }, type: QueryTypes.SELECT }
  );
  if (!rutas.length) {
    return { error: `La handheld ${handheld} no tiene una ruta activa asignada` };
  }

  return {
    handheld: { HANDHELD: hh.HANDHELD, DESCRIPCION: hh.DESCRIPCION },
    rutas,
  };
};

module.exports = { resolverHandheld };
