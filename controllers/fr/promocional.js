//
// Solicitudes de material promocional (web). Las registra el vendedor en la app y las sube con
// POST /fr/sync/enviar (arreglo `promocionales`); aqui se consultan y se marcan como procesadas.
// Tabla: erpadmin.PROMOCIONALES_RT. Llave ID (identity); UNIQUE (HANDHELD, CLIENTE, FECHA_SOLICITUD)
// evita duplicar los reenvios de la app.
//
//   GET /fr/promocional?docPro=&ruta=&cliente=&agente=&handheld=&desde=&hasta=&q=&page=&limit=
//       desde/hasta: YYYY-MM-DD sobre FECHA_REQUERIDA (inclusive). docPro: N pendiente / S procesado.
//       q: codigo o nombre del cliente, o texto de NOTAS (parcial).
//       Orden: pendientes primero, luego por FECHA_REQUERIDA (la mas proxima arriba).
//   GET /fr/promocional/:id
//   PUT /fr/promocional/:id/procesar   { docPro: "S" | "N" }   (por defecto "S")
//       "S" guarda PROCESADO_POR (usuario de la sesion) y FECHA_PROCESADO; "N" los limpia (reabrir).
//
// Fechas como texto: FECHA_REQUERIDA 'YYYY-MM-DD'; el resto 'YYYY-MM-DD HH:MM:SS'.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");
const { usuarioActual } = require("../../utils/alcanceFr");

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

const FROM_PROMOCIONAL = `
    FROM COAGRO2.erpadmin.PROMOCIONALES_RT P
    OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente WHERE COD_CLT = P.CLIENTE) C
    OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT WHERE RUTA = P.RUTA) R
    OUTER APPLY (SELECT TOP 1 AR.NOMBRE
                   FROM COAGRO2.erpadmin.AGENTE_ASOC_RT AA
                   JOIN COAGRO2.erpadmin.AGENTE_RT AR ON AR.AGENTE = AA.AGENTE
                  WHERE AA.CODIGO = P.AGENTE) A`;

const SELECT_PROMOCIONAL = `
  SELECT P.ID, LTRIM(RTRIM(P.COMPANIA)) AS COMPANIA,
         LTRIM(RTRIM(P.RUTA)) AS RUTA, LTRIM(RTRIM(R.DESCRIPCION)) AS RUTA_DESCRIPCION,
         LTRIM(RTRIM(P.CLIENTE)) AS CLIENTE, LTRIM(RTRIM(C.NOM_CLT)) AS NOM_CLT,
         LTRIM(RTRIM(P.AGENTE)) AS AGENTE, LTRIM(RTRIM(A.NOMBRE)) AS NOMBRE_AGENTE,
         LTRIM(RTRIM(P.HANDHELD)) AS HANDHELD, P.NOTAS,
         CONVERT(varchar(10), P.FECHA_REQUERIDA, 23) AS FECHA_REQUERIDA,
         CONVERT(varchar(19), P.FECHA_SOLICITUD, 120) AS FECHA_SOLICITUD,
         P.DOC_PRO,
         CONVERT(varchar(19), P.FECHA_CREACION, 120) AS FECHA_CREACION,
         P.PROCESADO_POR, CONVERT(varchar(19), P.FECHA_PROCESADO, 120) AS FECHA_PROCESADO
  ${FROM_PROMOCIONAL}`;

const armarFiltros = (query) => {
  const condiciones = [];
  const replacements = {};
  const igual = { ruta: "P.RUTA", cliente: "P.CLIENTE", agente: "P.AGENTE", handheld: "P.HANDHELD" };
  for (const [param, columna] of Object.entries(igual)) {
    const v = texto(query[param]);
    if (v) {
      condiciones.push(`${columna} = :${param}`);
      replacements[param] = v;
    }
  }

  const docPro = texto(query.docPro).toUpperCase();
  if (docPro) {
    if (!["S", "N"].includes(docPro)) return { error: "docPro debe ser S (procesado) o N (pendiente)" };
    condiciones.push("P.DOC_PRO = :docPro");
    replacements.docPro = docPro;
  }
  for (const [param, op] of [["desde", ">="], ["hasta", "<="]]) {
    const v = texto(query[param]);
    if (!v) continue;
    if (!FORMATO_FECHA.test(v)) return { error: `${param} debe tener formato YYYY-MM-DD` };
    condiciones.push(`P.FECHA_REQUERIDA ${op} CONVERT(date, :${param}, 23)`);
    replacements[param] = v;
  }
  const q = texto(query.q);
  if (q) {
    condiciones.push("(P.CLIENTE LIKE :q OR C.NOM_CLT LIKE :q OR P.NOTAS LIKE :q)");
    replacements.q = `%${q}%`;
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "", replacements };
};

const idValido = (v) => (/^\d+$/.test(texto(v)) ? Number(v) : null);

const buscarPorId = async (id) => {
  const [fila] = await sequelize.query(`${SELECT_PROMOCIONAL} WHERE P.ID = :id`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  });
  return fila || null;
};

// GET /fr/promocional
const getPromocionales = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) return error(res, filtros.error);
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, [conteo]] = await Promise.all([
      sequelize.query(
        `${SELECT_PROMOCIONAL}
          ${filtros.where}
          ORDER BY CASE WHEN P.DOC_PRO = 'N' THEN 0 ELSE 1 END, P.FECHA_REQUERIDA, P.ID
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { replacements: { ...filtros.replacements, offset, limit }, type: QueryTypes.SELECT }
      ),
      sequelize.query(`SELECT COUNT(*) AS TOTAL ${FROM_PROMOCIONAL} ${filtros.where}`, {
        replacements: filtros.replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    const total = conteo.TOTAL;
    res.send({
      result: rows,
      success: true,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (e) {
    console.log(e);
    error(res, "Error al consultar los promocionales");
  }
};

// GET /fr/promocional/:id
const getPromocional = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) return error(res, "id debe ser un numero");
    const fila = await buscarPorId(id);
    if (!fila) return error(res, `No existe el promocional ${id}`);
    res.send({ result: fila, success: true });
  } catch (e) {
    console.log(e);
    error(res, "Error al consultar el promocional");
  }
};

// PUT /fr/promocional/:id/procesar
const putProcesarPromocional = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) return error(res, "id debe ser un numero");
    const docPro = texto((req.body || {}).docPro || "S").toUpperCase();
    if (!["S", "N"].includes(docPro)) return error(res, "docPro debe ser S (procesado) o N (pendiente)");

    const [, filas] = await sequelize.query(
      `UPDATE COAGRO2.erpadmin.PROMOCIONALES_RT
          SET DOC_PRO = :docPro,
              PROCESADO_POR = ${docPro === "S" ? ":usuario" : "NULL"},
              FECHA_PROCESADO = ${docPro === "S" ? "GETDATE()" : "NULL"}
        WHERE ID = :id`,
      { replacements: { id, docPro, usuario: usuarioActual(req) }, type: QueryTypes.UPDATE }
    );
    if (!filas) return error(res, `No existe el promocional ${id}`);
    res.send({ result: await buscarPorId(id), success: true });
  } catch (e) {
    console.log(e);
    error(res, "Error al procesar el promocional");
  }
};

module.exports = { getPromocionales, getPromocional, putProcesarPromocional };
