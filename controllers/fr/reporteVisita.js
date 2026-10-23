//
// Reportes (web) de las visitas que registran las handhelds. Solo lectura.
//
// Tablas:
//   - erpadmin.VISITA            -> la visita (cliente, ruta, inicio/fin, razon, tipo, notas, documento)
//   - erpadmin.VISITA_UBICACION  -> punto GPS tomado al iniciar la visita (misma llave CLIENTE+RUTA+INICIO)
//   - erpadmin.cliente           -> nombre del cliente (COD_CLT = VISITA.CLIENTE)
//   - erpadmin.RUTA_RT           -> nombre de la ruta
//   - erpadmin.EFECT_VISITA_RT   -> descripcion de la razon/estado de la visita (EFECT_VISITA = VISITA.RAZON)
//
// Filtros comunes (query): ?ruta, ?cliente, ?razon, ?tipo, ?desde=YYYY-MM-DD, ?hasta=YYYY-MM-DD
// (desde/hasta filtran por la fecha de INICIO, ambos inclusive), mas ?page y ?limit.
//
// Notas:
//  - Los nombres se buscan con OUTER APPLY (TOP 1): erpadmin.cliente puede traer el mismo
//    COD_CLT repetido y asi no se duplican visitas.
//  - Las fechas se pasan como 'YYYYMMDD', formato que SQL Server interpreta igual sin importar
//    el DATEFORMAT/idioma de la sesion.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Arma el WHERE y los replacements a partir del query string.
// Devuelve { error } si alguna fecha viene mal.
const armarFiltros = (query) => {
  const { ruta, cliente, razon, tipo, desde, hasta } = query;
  const condiciones = [];
  const replacements = {};

  if (ruta) {
    condiciones.push("V.RUTA = :ruta");
    replacements.ruta = ruta;
  }
  if (cliente) {
    condiciones.push("V.CLIENTE = :cliente");
    replacements.cliente = cliente;
  }
  if (razon) {
    condiciones.push("V.RAZON = :razon");
    replacements.razon = razon;
  }
  if (tipo) {
    condiciones.push("V.TIPO = :tipo");
    replacements.tipo = tipo;
  }
  if (desde) {
    if (!FECHA_REGEX.test(desde)) return { error: "El campo desde debe tener formato YYYY-MM-DD" };
    condiciones.push("V.INICIO >= CAST(:desde AS datetime)");
    replacements.desde = desde.replace(/-/g, "");
  }
  if (hasta) {
    if (!FECHA_REGEX.test(hasta)) return { error: "El campo hasta debe tener formato YYYY-MM-DD" };
    condiciones.push("V.INICIO < DATEADD(day, 1, CAST(:hasta AS datetime))");
    replacements.hasta = hasta.replace(/-/g, "");
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "",
    replacements,
  };
};

const pagination = (total, { page, limit }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});

// GET /fr/reporteVisita?ruta=&cliente=&razon=&tipo=&desde=&hasta=&page=1&limit=20
// Detalle: una fila por visita, con nombres, duracion en minutos y su ubicacion GPS (si la hay).
const getReporteVisitas = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `SELECT V.RUTA, R.DESCRIPCION AS RUTA_DESCRIPCION,
                V.CLIENTE, C.NOM_CLT AS CLIENTE_NOMBRE,
                V.INICIO, V.FIN, DATEDIFF(minute, V.INICIO, V.FIN) AS DURACION_MIN,
                V.FECHA_PLAN, V.RAZON, E.DESCRIPCION AS RAZON_DESCRIPCION,
                V.TIPO, V.NOTAS, V.DOC_PRO,
                U.LATITUD, U.LONGITUD, U.ALTITUD, U.TIEMPO_GPS, U.TIEMPO_PDA, U.PDOP, U.ERROR
           FROM COAGRO2.erpadmin.VISITA V
           OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                         WHERE COD_CLT = V.CLIENTE) C
           OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                         WHERE RUTA = V.RUTA) R
           OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.EFECT_VISITA_RT
                         WHERE EFECT_VISITA = V.RAZON) E
           OUTER APPLY (SELECT TOP 1 LATITUD, LONGITUD, ALTITUD, TIEMPO_GPS, TIEMPO_PDA, PDOP, ERROR
                          FROM COAGRO2.erpadmin.VISITA_UBICACION
                         WHERE CLIENTE = V.CLIENTE AND RUTA = V.RUTA AND INICIO = V.INICIO) U
           ${filtros.where}
          ORDER BY V.INICIO DESC, V.RUTA, V.CLIENTE
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        {
          replacements: { ...filtros.replacements, offset, limit },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL FROM COAGRO2.erpadmin.VISITA V ${filtros.where}`,
        { replacements: filtros.replacements, type: QueryTypes.SELECT }
      ),
    ]);

    res.send({
      result: rows,
      success: true,
      pagination: pagination(conteo[0].TOTAL, { page, limit }),
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el reporte de visitas"],
    });
  }
};

// GET /fr/reporteVisita/resumen?ruta=&cliente=&razon=&tipo=&desde=&hasta=&page=1&limit=20
// Resumen por ruta y dia: cuantas visitas, a cuantos clientes, cuantas con GPS, duracion
// promedio/total y la primera y ultima hora de la jornada.
const getResumenVisitas = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const agrupado = `
      SELECT V.RUTA, CAST(V.INICIO AS date) AS FECHA,
             COUNT(*) AS TOTAL_VISITAS,
             COUNT(DISTINCT V.CLIENTE) AS CLIENTES_VISITADOS,
             SUM(CASE WHEN U.LATITUD IS NOT NULL THEN 1 ELSE 0 END) AS VISITAS_CON_GPS,
             AVG(DATEDIFF(minute, V.INICIO, V.FIN)) AS DURACION_PROMEDIO_MIN,
             SUM(DATEDIFF(minute, V.INICIO, V.FIN)) AS DURACION_TOTAL_MIN,
             MIN(V.INICIO) AS PRIMERA_VISITA,
             MAX(V.FIN) AS ULTIMA_VISITA
        FROM COAGRO2.erpadmin.VISITA V
        OUTER APPLY (SELECT TOP 1 LATITUD FROM COAGRO2.erpadmin.VISITA_UBICACION
                      WHERE CLIENTE = V.CLIENTE AND RUTA = V.RUTA AND INICIO = V.INICIO) U
        ${filtros.where}
       GROUP BY V.RUTA, CAST(V.INICIO AS date)`;

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `SELECT G.*, R.DESCRIPCION AS RUTA_DESCRIPCION
           FROM (${agrupado}) G
           OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                         WHERE RUTA = G.RUTA) R
          ORDER BY G.FECHA DESC, G.RUTA
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        {
          replacements: { ...filtros.replacements, offset, limit },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(`SELECT COUNT(*) AS TOTAL FROM (${agrupado}) G`, {
        replacements: filtros.replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    res.send({
      result: rows,
      success: true,
      pagination: pagination(conteo[0].TOTAL, { page, limit }),
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el resumen de visitas"],
    });
  }
};

module.exports = { getReporteVisitas, getResumenVisitas };
