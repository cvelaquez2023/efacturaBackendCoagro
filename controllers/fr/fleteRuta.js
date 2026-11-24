//
// Mantenimiento (web) del flete por ruta. Solo lee/edita las 4 columnas de flete de
// erpadmin.RUTA_CONSECUT_RT (ver utils/fleteRuta.js y docs/fr-flete-ruta.sql).
//
// No hay POST ni DELETE: la fila es la de consecutivos de la ruta (se crea con POST /fr/rutaConsecutRt).
// "Quitar" el flete = usaFlete 'N'. Una ruta sin consecutivos no puede tener flete (y la handheld
// tampoco podria hacer pedidos con ella).
//
// Endpoints:
//   GET /fr/fleteRuta?ruta=&usaFlete=S|N&page=1&limit=20  -> listado con descripcion de ruta y articulo
//   GET /fr/fleteRuta/:ruta                               -> una ruta
//   PUT /fr/fleteRuta/:ruta   { usaFlete?, minimoFlete?, montoFlete?, articuloFlete? }
//   PUT /fr/fleteRuta         { rutas: ['R01', ...] | todas: true, usaFlete?, minimoFlete?, montoFlete?, articuloFlete? }
//                             -> masivo, todo o nada (si una ruta no pasa la validacion no se guarda ninguna)
//
// Fila de respuesta:
//   { RUTA, RUTA_DESCRIPCION, USA_FLETE, MINIMO_FLETE, MONTO_FLETE, ARTICULO_FLETE, ARTICULO_DESCRIPCION }
// MINIMO_FLETE / MONTO_FLETE salen como numero.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion } = require("../../utils/paginacion");
const { COLUMNAS_FLETE, tomarFlete, validarFlete } = require("../../utils/fleteRuta");

const SELECT_FLETE = `
  SELECT LTRIM(RTRIM(C.RUTA)) AS RUTA, R.DESCRIPCION AS RUTA_DESCRIPCION,
         C.USA_FLETE, CAST(C.MINIMO_FLETE AS float) AS MINIMO_FLETE, CAST(C.MONTO_FLETE AS float) AS MONTO_FLETE,
         LTRIM(RTRIM(C.ARTICULO_FLETE)) AS ARTICULO_FLETE, A.DES_ART AS ARTICULO_DESCRIPCION
    FROM COAGRO2.erpadmin.RUTA_CONSECUT_RT C
    OUTER APPLY (SELECT TOP 1 DESCRIPCION FROM COAGRO2.erpadmin.RUTA_RT WHERE RUTA = C.RUTA) R
    OUTER APPLY (SELECT TOP 1 DES_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART = C.ARTICULO_FLETE) A`;

const leerFlete = async (ruta) => {
  const [fila] = await sequelize.query(`${SELECT_FLETE} WHERE C.RUTA = :ruta`, {
    replacements: { ruta },
    type: QueryTypes.SELECT,
  });
  return fila || null;
};

const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

// GET /fr/fleteRuta?ruta=&usaFlete=&page=1&limit=20
const getFletesRuta = async (req, res) => {
  try {
    const { ruta, usaFlete } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);
    const condiciones = [];
    const replacements = { offset, limit };
    if (ruta) {
      condiciones.push("C.RUTA LIKE :ruta");
      replacements.ruta = `%${ruta}%`;
    }
    if (usaFlete) {
      condiciones.push("C.USA_FLETE = :usaFlete");
      replacements.usaFlete = usaFlete;
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const [filas, [{ total }]] = await Promise.all([
      sequelize.query(`${SELECT_FLETE} ${where} ORDER BY C.RUTA OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize.query(`SELECT COUNT(*) AS total FROM COAGRO2.erpadmin.RUTA_CONSECUT_RT C ${where}`, {
        replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    res.send({
      result: filas,
      success: true,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (e) {
    console.log(e);
    error(res, "Error al consultar el flete de las rutas");
  }
};

// GET /fr/fleteRuta/:ruta
const getFleteRuta = async (req, res) => {
  try {
    const fila = await leerFlete(req.params.ruta);
    if (!fila) return error(res, `La ruta ${req.params.ruta} no tiene consecutivos configurados.`);
    res.send({ result: fila, success: true });
  } catch (e) {
    console.log(e);
    error(res, "Error al consultar el flete de la ruta");
  }
};

const armarUpdate = (cambios) => COLUMNAS_FLETE.filter((c) => c in cambios).map((c) => `${c} = :${c}`).join(", ");

// PUT /fr/fleteRuta/:ruta  { usaFlete?, minimoFlete?, montoFlete?, articuloFlete? }
const putFleteRuta = async (req, res) => {
  const { ruta } = req.params;
  try {
    const cambios = tomarFlete(req.body || {});
    if (!Object.keys(cambios).length) {
      return error(res, "Manda al menos uno: usaFlete, minimoFlete, montoFlete, articuloFlete");
    }
    const actual = await leerFlete(ruta);
    if (!actual) return error(res, `La ruta ${ruta} no tiene consecutivos configurados.`);

    const mensaje = await validarFlete({ ...actual, ...cambios });
    if (mensaje) return error(res, mensaje);

    await sequelize.query(`UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT SET ${armarUpdate(cambios)} WHERE RUTA = :ruta`, {
      replacements: { ...cambios, ruta },
    });
    res.send({ result: await leerFlete(ruta), success: true });
  } catch (e) {
    console.log(e);
    error(res, "Error al actualizar el flete de la ruta");
  }
};

// PUT /fr/fleteRuta  { rutas: [...] | todas: true, usaFlete?, minimoFlete?, montoFlete?, articuloFlete? }
const putFleteRutas = async (req, res) => {
  try {
    const body = req.body || {};
    const cambios = tomarFlete(body);
    if (!Object.keys(cambios).length) {
      return error(res, "Manda al menos uno: usaFlete, minimoFlete, montoFlete, articuloFlete");
    }
    const todas = body.todas === true;
    const rutas = Array.isArray(body.rutas) ? [...new Set(body.rutas.map((r) => String(r).trim()).filter(Boolean))] : [];
    if (!todas && !rutas.length) return error(res, "Manda rutas: ['R01', ...] o todas: true");

    const resultado = await sequelize.transaction(async (transaction) => {
      const actuales = await sequelize.query(
        `${SELECT_FLETE} ${todas ? "" : "WHERE C.RUTA IN (:rutas)"} ORDER BY C.RUTA`,
        { replacements: { rutas }, type: QueryTypes.SELECT, transaction }
      );
      if (!todas) {
        const encontradas = new Set(actuales.map((a) => a.RUTA));
        const faltan = rutas.filter((r) => !encontradas.has(r));
        if (faltan.length) return { mensaje: `Sin consecutivos configurados: ${faltan.join(", ")}` };
      }
      if (!actuales.length) return { mensaje: "No hay rutas con consecutivos configurados" };

      // Articulos a revisar (una sola consulta para todas las rutas).
      const finales = actuales.map((a) => ({ ...a, ...cambios }));
      const codigos = [...new Set(finales.map((f) => String(f.ARTICULO_FLETE ?? "103").trim()).filter(Boolean))];
      const existentes = await sequelize.query(
        `SELECT LTRIM(RTRIM(COD_ART)) AS COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART IN (:codigos)`,
        { replacements: { codigos: codigos.length ? codigos : [""] }, type: QueryTypes.SELECT, transaction }
      );
      const setExistentes = new Set(existentes.map((e) => e.COD_ART));
      for (const f of finales) {
        const mensaje = await validarFlete(f, setExistentes);
        if (mensaje) return { mensaje: `Ruta ${f.RUTA}: ${mensaje}` };
      }

      await sequelize.query(
        `UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT SET ${armarUpdate(cambios)} WHERE RUTA IN (:rutasFinales)`,
        { replacements: { ...cambios, rutasFinales: actuales.map((a) => a.RUTA) }, transaction }
      );
      return { actualizadas: actuales.length };
    });

    if (resultado.mensaje) return error(res, resultado.mensaje);
    res.send({ result: { actualizadas: resultado.actualizadas }, success: true });
  } catch (e) {
    console.log(e);
    error(res, "Error al actualizar el flete de las rutas");
  }
};

module.exports = { getFletesRuta, getFleteRuta, putFleteRuta, putFleteRutas };
