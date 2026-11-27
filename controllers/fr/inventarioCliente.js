//
// Consulta (web) de los inventarios que el vendedor le toma al cliente desde la app
// (POST /fr/sync/enviar -> inventarios). Solo lectura: los crea unicamente la app movil.
//
// Tablas:
//   - erpadmin.alFAC_ENC_INV -> encabezado (llave COD_CIA + COD_ZON + NUM_INV; la PK tambien trae COD_CLT)
//   - erpadmin.alFAC_DET_INV -> lineas (misma llave + COD_ART): CNT_MAX = cajas, CNT_MIN = unidades
//   - erpadmin.cliente       -> nombre del cliente (COD_CLT)
//   - erpadmin.RUTA_RT       -> nombre de la ruta (RUTA = COD_ZON)
//   - erpadmin.ARTICULO      -> descripcion del articulo (COD_ART)
//
// Filtros (query): ?ruta, ?cliente, ?docPro, ?inventario (NUM_INV, parcial), ?desde=YYYY-MM-DD,
// ?hasta=YYYY-MM-DD (por FEC_INV, ambos inclusive), mas ?page y ?limit.
//
// Notas:
//  - Los nombres se buscan con OUTER APPLY (TOP 1) para no duplicar filas.
//  - Fechas (HOR_INI, HOR_FIN, FEC_INV) como texto 'YYYY-MM-DD HH:MM:SS', tal cual estan guardadas.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");
const { FECHAS_ENC_INV } = require("./syncEnviar");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const SELECT_ENC = `
  SELECT E.COD_CIA, E.NUM_INV, E.COD_ZON, E.COD_CLT,
         ${FECHAS_ENC_INV.map((c) => `CONVERT(varchar(19), E.${c}, 120) AS ${c}`).join(", ")},
         E.NUM_ITM, E.DOC_PRO, C.NOM_CLT AS CLIENTE_NOMBRE, R.DESCRIPCION AS RUTA_DESCRIPCION
    FROM COAGRO2.erpadmin.alFAC_ENC_INV E
    OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente WHERE COD_CLT = E.COD_CLT) C
    OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT WHERE RUTA = E.COD_ZON) R`;

// Arma el WHERE y los replacements a partir del query string. { error } si una fecha viene mal.
const armarFiltros = (query) => {
  const { ruta, cliente, docPro, inventario, desde, hasta } = query;
  const condiciones = [];
  const replacements = {};
  const igual = (valor, columna, nombre) => {
    if (!valor) return;
    condiciones.push(`E.${columna} = :${nombre}`);
    replacements[nombre] = valor;
  };

  igual(ruta, "COD_ZON", "ruta");
  igual(cliente, "COD_CLT", "cliente");
  igual(docPro, "DOC_PRO", "docPro");
  if (inventario) {
    condiciones.push("E.NUM_INV LIKE :inventario");
    replacements.inventario = `%${inventario}%`;
  }
  if (desde) {
    if (!FECHA_REGEX.test(desde)) return { error: "El campo desde debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_INV >= CAST(:desde AS datetime)");
    replacements.desde = desde.replace(/-/g, "");
  }
  if (hasta) {
    if (!FECHA_REGEX.test(hasta)) return { error: "El campo hasta debe tener formato YYYY-MM-DD" };
    condiciones.push("E.FEC_INV < DATEADD(day, 1, CAST(:hasta AS datetime))");
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

// GET /fr/inventarioCliente?ruta=&cliente=&docPro=&inventario=&desde=&hasta=&page=1&limit=20
// Listado: una fila por inventario con nombre de cliente y ruta.
const getInventariosCliente = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `${SELECT_ENC}
         ${filtros.where}
         ORDER BY E.FEC_INV DESC, E.NUM_INV DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { replacements: { ...filtros.replacements, offset, limit }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL FROM COAGRO2.erpadmin.alFAC_ENC_INV E ${filtros.where}`,
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
    res.send({ result: {}, success: false, errors: ["Error al consultar los inventarios"] });
  }
};

// GET /fr/inventarioCliente/:cia/:ruta/:inventario
// Detalle: encabezado y lineas (con la descripcion del articulo).
const getInventarioCliente = async (req, res) => {
  try {
    const { cia, ruta, inventario } = req.params;
    const replacements = { cia, ruta, inventario };

    const [[encabezado], lineas] = await Promise.all([
      sequelize.query(
        `${SELECT_ENC}
         WHERE E.COD_CIA = :cia AND E.COD_ZON = :ruta AND E.NUM_INV = :inventario`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.COD_ART, A.DES_ART, CAST(D.CNT_MAX AS float) AS CNT_MAX, CAST(D.CNT_MIN AS float) AS CNT_MIN,
                D.DOC_PRO
           FROM COAGRO2.erpadmin.alFAC_DET_INV D
           OUTER APPLY (SELECT TOP 1 DES_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART = D.COD_ART) A
          WHERE D.COD_CIA = :cia AND D.COD_ZON = :ruta AND D.NUM_INV = :inventario
          ORDER BY D.COD_ART`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    if (!encabezado) {
      return res.send({ result: {}, success: false, errors: ["El inventario no existe"] });
    }

    res.send({ result: { encabezado, lineas }, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar el inventario"] });
  }
};

module.exports = { getInventariosCliente, getInventarioCliente };
