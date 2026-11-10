//
// Consulta (web) de las ubicaciones GPS de clientes que guardan las handhelds. Solo lectura.
// Las graba la app en POST /fr/sync/enviar (arreglo `ubicaciones`, llave RUTA + CLIENTE).
//
// Tablas:
//   - erpadmin.CLIENTE_UBICACION -> RUTA, CLIENTE, LATITUD, LONGITUD, ALTITUD
//   - erpadmin.cliente           -> nombre y direccion del cliente (COD_CLT = CLIENTE)
//   - erpadmin.RUTA_RT           -> nombre de la ruta
//
// Filtros (query): ?ruta, ?cliente (codigo exacto), ?q (codigo o nombre del cliente, parcial),
// mas ?page y ?limit.
//
// Notas:
//  - Los nombres se buscan con OUTER APPLY (TOP 1): erpadmin.cliente puede traer el mismo COD_CLT
//    repetido y asi no se duplican filas.
//  - MAPA es un enlace de Google Maps armado con LATITUD/LONGITUD (null si falta alguna).

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");

const SELECT_UBICACION = `
  SELECT U.RUTA, R.DESCRIPCION AS RUTA_DESCRIPCION,
         U.CLIENTE, C.NOM_CLT AS CLIENTE_NOMBRE, C.DIR_CLT AS CLIENTE_DIRECCION,
         U.LATITUD, U.LONGITUD, U.ALTITUD
    FROM COAGRO2.erpadmin.CLIENTE_UBICACION U
    OUTER APPLY (SELECT TOP 1 NOM_CLT, DIR_CLT FROM COAGRO2.erpadmin.cliente
                  WHERE COD_CLT = U.CLIENTE) C
    OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT
                  WHERE RUTA = U.RUTA) R`;

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());

const conMapa = (fila) =>
  Object.fromEntries(
    Object.entries({
      ...fila,
      MAPA:
        fila.LATITUD !== null && fila.LONGITUD !== null
          ? `https://www.google.com/maps?q=${fila.LATITUD},${fila.LONGITUD}`
          : null,
    }).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );

// Arma el WHERE y los replacements a partir del query string.
const armarFiltros = (query) => {
  const ruta = texto(query.ruta);
  const cliente = texto(query.cliente);
  const q = texto(query.q);
  const condiciones = [];
  const replacements = {};

  if (ruta) {
    condiciones.push("U.RUTA = :ruta");
    replacements.ruta = ruta;
  }
  if (cliente) {
    condiciones.push("U.CLIENTE = :cliente");
    replacements.cliente = cliente;
  }
  if (q) {
    condiciones.push("(U.CLIENTE LIKE :q OR C.NOM_CLT LIKE :q)");
    replacements.q = `%${q}%`;
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "",
    replacements,
  };
};

// GET /fr/clienteUbicacion?ruta=&cliente=&q=&page=1&limit=20
const getClientesUbicacion = async (req, res) => {
  try {
    const filtros = armarFiltros(req.query);
    const { page, limit, offset } = getPaginacion(req.query);

    const [rows, conteo] = await Promise.all([
      sequelize.query(
        `${SELECT_UBICACION}
          ${filtros.where}
          ORDER BY U.RUTA, U.CLIENTE
          OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        {
          replacements: { ...filtros.replacements, offset, limit },
          type: QueryTypes.SELECT,
        }
      ),
      // El filtro ?q usa el nombre del cliente, por eso el conteo tambien lleva el OUTER APPLY.
      sequelize.query(
        `SELECT COUNT(*) AS TOTAL
           FROM COAGRO2.erpadmin.CLIENTE_UBICACION U
           OUTER APPLY (SELECT TOP 1 NOM_CLT FROM COAGRO2.erpadmin.cliente
                         WHERE COD_CLT = U.CLIENTE) C
          ${filtros.where}`,
        { replacements: filtros.replacements, type: QueryTypes.SELECT }
      ),
    ]);

    const total = conteo[0].TOTAL;
    res.send({
      result: rows.map(conMapa),
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar las ubicaciones de clientes"],
    });
  }
};

// GET /fr/clienteUbicacion/:ruta/:cliente
const getClienteUbicacion = async (req, res) => {
  try {
    const [fila] = await sequelize.query(
      `${SELECT_UBICACION}
        WHERE U.RUTA = :ruta AND U.CLIENTE = :cliente`,
      {
        replacements: { ruta: texto(req.params.ruta), cliente: texto(req.params.cliente) },
        type: QueryTypes.SELECT,
      }
    );
    if (!fila) {
      return res.send({
        result: {},
        success: false,
        errors: [`El cliente ${req.params.cliente} no tiene ubicacion registrada en la ruta ${req.params.ruta}`],
      });
    }
    res.send({ result: conMapa(fila), success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar la ubicacion del cliente"],
    });
  }
};

module.exports = { getClientesUbicacion, getClienteUbicacion };
