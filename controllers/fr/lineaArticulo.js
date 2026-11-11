const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");

/**
 * GET /fr/lineaArticulo?q=
 * Solo lectura. Lineas de articulo = CINCOH.CLASIFICACION con AGRUPACION 3
 * (lo que guarda ARTICULO.CLASIFICACION_3: CALOX, Bayer...). Lista completa
 * (son pocas), para el selector de linea de condiciones y promociones.
 */
const getLineasArticulo = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const data = await sequelize.query(
      `SELECT CLASIFICACION AS LINEA, DESCRIPCION
         FROM CINCOH.CLASIFICACION
        WHERE AGRUPACION = 3
          AND (:q = '' OR CLASIFICACION LIKE :like OR DESCRIPCION LIKE :like)
        ORDER BY DESCRIPCION`,
      { replacements: { q, like: `%${q}%` }, type: QueryTypes.SELECT }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar las lineas de articulo"] });
  }
};

module.exports = { getLineasArticulo };
