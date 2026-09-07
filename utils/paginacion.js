/**
 * Utilidades de paginacion para los GET que devuelven listas.
 *
 * Query params soportados:
 *   ?page   -> numero de pagina, base 1 (default 1)
 *   ?limit  -> registros por pagina (default 20, maximo 100)
 */

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

const getPaginacion = (
  query = {},
  { limitDefault = LIMIT_DEFAULT, limitMax = LIMIT_MAX } = {}
) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = limitDefault;
  if (limit > limitMax) limit = limitMax;

  return { page, limit, offset: (page - 1) * limit };
};

/**
 * Arma la respuesta estandar a partir del resultado de findAndCountAll.
 * @param {{count: number, rows: any[]}} resultado
 * @param {{page: number, limit: number}} paginacion
 */
const respuestaPaginada = ({ count, rows }, { page, limit }) => {
  const total = Array.isArray(count) ? count.length : count;
  return {
    result: rows,
    success: true,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

module.exports = { getPaginacion, respuestaPaginada, LIMIT_DEFAULT, LIMIT_MAX };
