//
// Consulta (web) de los pedidos que envian las handhelds por /fr/sync. Solo lectura.
//
// Tablas:
//   - erpadmin.alFAC_ENC_PED -> encabezado del pedido (llave COD_CIA + NUM_PED)
//   - erpadmin.alFAC_DET_PED -> lineas del pedido (misma llave COD_CIA + NUM_PED)
//   - erpadmin.cliente       -> nombre del cliente (COD_CLT)
//   - erpadmin.RUTA_RT       -> nombre de la ruta (RUTA = COD_ZON)
//   - erpadmin.ARTICULO      -> descripcion del articulo (COD_ART)
//
// Filtros (query): ?ruta, ?cliente, ?estado, ?bodega, ?pedido (busqueda parcial),
// ?desde=YYYY-MM-DD, ?hasta=YYYY-MM-DD (filtran por FEC_PED, ambos inclusive), mas ?page y ?limit.
//
// Notas:
//  - Los nombres se buscan con OUTER APPLY (TOP 1) para no duplicar pedidos.
//  - Las fechas se pasan como 'YYYYMMDD', formato que SQL Server interpreta igual sin importar
//    el DATEFORMAT/idioma de la sesion.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Arma el WHERE y los replacements a partir del query string.
// Devuelve { error } si alguna fecha viene mal.
const armarFiltros = (query) => {
  const { ruta, cliente, estado, bodega, pedido, desde, hasta } = query;
  const condiciones = [];
  const replacements = {};

  if (ruta) {
    condiciones.push("P.COD_ZON = :ruta");
    replacements.ruta = ruta;
  }
  if (cliente) {
    condiciones.push("P.COD_CLT = :cliente");
    replacements.cliente = cliente;
  }
  if (estado) {
    condiciones.push("P.ESTADO = :estado");
    replacements.estado = estado;
  }
  if (bodega) {
    condiciones.push("P.COD_BOD = :bodega");
    replacements.bodega = bodega;
  }
  if (pedido) {
    condiciones.push("P.NUM_PED LIKE :pedido");
    replacements.pedido = `%${pedido}%`;
  }
  if (desde) {
    if (!FECHA_REGEX.test(desde)) return { error: "El campo desde debe tener formato YYYY-MM-DD" };
    condiciones.push("P.FEC_PED >= CAST(:desde AS datetime)");
    replacements.desde = desde.replace(/-/g, "");
  }
  if (hasta) {
    if (!FECHA_REGEX.test(hasta)) return { error: "El campo hasta debe tener formato YYYY-MM-DD" };
    condiciones.push("P.FEC_PED < DATEADD(day, 1, CAST(:hasta AS datetime))");
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

// GET /fr/pedido?ruta=&cliente=&estado=&bodega=&pedido=&desde=&hasta=&page=1&limit=20
// Listado: una fila por pedido (todas las columnas del encabezado) con nombre de cliente y ruta.
const getPedidos = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    if (filtros.error) {
      return res.send({ result: {}, success: false, errors: [filtros.error] });
    }
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `SELECT P.*, C.NOM_CLT AS CLIENTE_NOMBRE, R.DESCRIPCION AS RUTA_DESCRIPCION
           FROM COAGRO2.erpadmin.alFAC_ENC_PED P
           OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                         WHERE COD_CLT = P.COD_CLT) C
           OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                         WHERE RUTA = P.COD_ZON) R
           ${filtros.where}
          ORDER BY P.FEC_PED DESC, P.NUM_PED DESC
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        {
          replacements: { ...filtros.replacements, offset, limit },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL FROM COAGRO2.erpadmin.alFAC_ENC_PED P ${filtros.where}`,
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
      errors: ["Error al consultar los pedidos"],
    });
  }
};

// GET /fr/pedido/:cia/:pedido
// Detalle: el encabezado del pedido y sus lineas con la descripcion del articulo.
const getPedido = async (req, res) => {
  try {
    const { cia, pedido } = req.params;
    const replacements = { cia, pedido };

    const [[encabezado], lineas] = await Promise.all([
      sequelize.query(
        `SELECT P.*, C.NOM_CLT AS CLIENTE_NOMBRE, R.DESCRIPCION AS RUTA_DESCRIPCION
           FROM COAGRO2.erpadmin.alFAC_ENC_PED P
           OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                         WHERE COD_CLT = P.COD_CLT) C
           OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                         WHERE RUTA = P.COD_ZON) R
          WHERE P.COD_CIA = :cia AND P.NUM_PED = :pedido`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT D.*, A.DES_ART
           FROM COAGRO2.erpadmin.alFAC_DET_PED D
           OUTER APPLY (SELECT TOP 1 DES_ART FROM COAGRO2.erpadmin.ARTICULO
                         WHERE COD_ART = D.COD_ART) A
          WHERE D.COD_CIA = :cia AND D.NUM_PED = :pedido
          ORDER BY D.NUM_LN`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    if (!encabezado) {
      return res.send({ result: {}, success: false, errors: ["El pedido no existe"] });
    }

    res.send({ result: { encabezado, lineas }, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar el pedido"],
    });
  }
};

module.exports = { getPedidos, getPedido };
