const moment = require("moment");
const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

/**
 * Base comun de los CRUD de descuentos y bonificaciones (tablas nativas de erpadmin
 * que baja la handheld): DESCUENTO_CLIART, DESCUENTO_NIVEL, BONIFICACION_CLIART,
 * BONIFICACION_NIVEL.
 *
 * Las cuatro comparten la misma forma:
 *   - una "entidad" (cliente+articulo, o nivel de precio+moneda+articulo),
 *   - un rango de cantidades (CANT_MIN..CANT_MAX) y de fechas (FECHA_INICIO..FECHA_FIN),
 *   - los valores (monto/porcentaje de descuento, articulo y unidades de bonificacion).
 * La PK real es COMPANIA + entidad + rango.
 *
 * COMPANIA: a diferencia de las tablas _RT, aqui es NOT NULL y parte de la PK, y el
 * resto de erpadmin (ARTICULO_PRECIO, NIVEL_LISTA) usa 'COAGRO'. Se guarda siempre
 * ese valor (o FR_COMPANIA del .env) y no se pide en el body.
 *
 * Reglas:
 *   - CANT_MIN <= CANT_MAX (enteros >= 0) y FECHA_INICIO <= FECHA_FIN (YYYY-MM-DD).
 *   - Para la misma entidad no puede haber dos filas cuyo rango de cantidades Y de
 *     fechas se traslapen (la handheld no sabria cual aplicar).
 *   - La entidad no se edita por PUT (se borra y se crea de nuevo); el rango y los
 *     valores si.
 */

const COMPANIA_FR = process.env.FR_COMPANIA || "COAGRO";

const RANGO = [
  { col: "CANT_MIN", param: "cantMin" },
  { col: "CANT_MAX", param: "cantMax" },
  { col: "FECHA_INICIO", param: "fechaInicio" },
  { col: "FECHA_FIN", param: "fechaFin" },
];

// ARTICULO_BONIF -> articuloBonif
const dbAJs = (columna) =>
  columna.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());

const esFecha = (v) => moment(v, "YYYY-MM-DD", true).isValid();

// Las columnas son datetime: se devuelven como 'YYYY-MM-DD' para no depender de la zona.
const fechaComoTexto = (col) => [
  sequelize.fn("CONVERT", sequelize.literal("varchar(10)"), sequelize.col(col), 23),
  col,
];

// ---------- Validaciones contra los catalogos que usa la handheld ----------

const existeArticulo = async (articulo) => {
  const [r] = await sequelize.query(
    `SELECT TOP 1 COD_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART = :articulo`,
    { replacements: { articulo }, type: QueryTypes.SELECT }
  );
  return !!r;
};

const existeCliente = async (cliente) => {
  const [r] = await sequelize.query(
    `SELECT TOP 1 COD_CLT FROM COAGRO2.erpadmin.cliente WHERE COD_CLT = :cliente`,
    { replacements: { cliente }, type: QueryTypes.SELECT }
  );
  return !!r;
};

const existeNivel = async (nivelPrecio, moneda) => {
  const [r] = await sequelize.query(
    `SELECT TOP 1 NIVEL_PRECIO FROM COAGRO2.erpadmin.NIVEL_LISTA
      WHERE NIVEL_PRECIO = :nivelPrecio AND MONEDA = :moneda`,
    { replacements: { nivelPrecio, moneda }, type: QueryTypes.SELECT }
  );
  return !!r;
};

// Validadores de entidad reutilizables por los controllers.
const validarClienteArticulo = async ({ CLIENTE, ARTICULO }) => {
  const errores = [];
  if (!(await existeCliente(CLIENTE)))
    errores.push(`El cliente ${CLIENTE} no existe en erpadmin.cliente.`);
  if (!(await existeArticulo(ARTICULO)))
    errores.push(`El articulo ${ARTICULO} no existe en erpadmin.ARTICULO.`);
  return errores;
};

const validarNivelArticulo = async ({ NIVEL_PRECIO, MONEDA, ARTICULO }) => {
  const errores = [];
  if (!(await existeNivel(NIVEL_PRECIO, MONEDA)))
    errores.push(
      `El nivel de precio ${NIVEL_PRECIO} con moneda ${MONEDA} no existe en erpadmin.NIVEL_LISTA.`
    );
  if (!(await existeArticulo(ARTICULO)))
    errores.push(`El articulo ${ARTICULO} no existe en erpadmin.ARTICULO.`);
  return errores;
};

// Numero >= 0 (o > 0 con estricto). Devuelve null si es valido o el mensaje de error.
const validarNumero = (valor, nombre, { obligatorio = true, estricto = false, max } = {}) => {
  if (valor === undefined || valor === null || valor === "") {
    return obligatorio ? `El campo ${nombre} es obligatorio` : null;
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) return `El campo ${nombre} debe ser numerico`;
  if (estricto ? n <= 0 : n < 0)
    return `El campo ${nombre} debe ser mayor ${estricto ? "que" : "o igual a"} 0`;
  if (max !== undefined && n > max) return `El campo ${nombre} no puede ser mayor que ${max}`;
  return null;
};

// ---------- Fabrica del CRUD ----------

/**
 * @param {object} cfg
 * @param {import("sequelize").ModelStatic} cfg.model
 * @param {string} cfg.nombre            texto para mensajes ("descuento por cliente")
 * @param {string[]} cfg.entidad         columnas de la entidad, en el orden de la URL
 * @param {string[]} cfg.valores         columnas de valores editables
 * @param {(ent: object) => Promise<string[]>} cfg.validarEntidad
 * @param {(val: object) => Promise<string[]>} cfg.validarValores  recibe columnas -> valor
 */
const crearCrudDescuento = ({ model, nombre, entidad, valores, validarEntidad, validarValores }) => {
  const LLAVE = [...entidad.map((col) => ({ col, param: dbAJs(col) })), ...RANGO];
  const llavePath = "/" + LLAVE.map((k) => `:${k.param}`).join("/");

  const ATRIBUTOS = [
    "COMPANIA",
    ...entidad,
    "CANT_MIN",
    "CANT_MAX",
    fechaComoTexto("FECHA_INICIO"),
    fechaComoTexto("FECHA_FIN"),
    ...valores,
  ];

  const parseErrores = (error, fallback) => {
    if (error.name === "SequelizeValidationError") return error.errors.map((e) => e.message);
    if (error.parent && error.parent.number === 8152)
      return ["Un valor supera el tamano permitido para esa columna."];
    if (error.parent && error.parent.number === 547)
      return ["Un valor no cumple una restriccion de la base de datos (CHECK)."];
    if (error.name === "SequelizeUniqueConstraintError")
      return [`Ya existe un ${nombre} con esa misma llave (entidad, cantidades y fechas).`];
    return [fallback];
  };

  const fallo = (res, errores) => res.send({ result: {}, success: false, errors: errores });

  // Toma la entidad y el rango de un objeto con nombres camelCase (params o body).
  const leerLlave = (fuente) => {
    const llave = {};
    LLAVE.forEach(({ col, param }) => {
      llave[col] = texto(fuente[param]);
    });
    return llave;
  };

  const tomarValores = (body) => {
    const v = {};
    valores.forEach((col) => {
      const valor = body[dbAJs(col)];
      if (valor !== undefined) v[col] = typeof valor === "string" ? valor.trim() : valor;
    });
    return v;
  };

  // Valida obligatorios, rango de cantidades y fechas. Normaliza CANT_* a numero.
  const validarLlave = (llave) => {
    const faltan = LLAVE.filter(({ col }) => llave[col] === "").map(({ param }) => param);
    if (faltan.length) return [`Faltan los campos obligatorios: ${faltan.join(", ")}`];

    const errores = [];
    ["CANT_MIN", "CANT_MAX"].forEach((col) => {
      const n = Number(llave[col]);
      if (!Number.isInteger(n) || n < 0) errores.push(`${dbAJs(col)} debe ser un entero >= 0`);
      else llave[col] = n;
    });
    ["FECHA_INICIO", "FECHA_FIN"].forEach((col) => {
      if (!esFecha(llave[col])) errores.push(`${dbAJs(col)} debe tener formato YYYY-MM-DD`);
    });
    if (errores.length) return errores;

    if (llave.CANT_MIN > llave.CANT_MAX) errores.push("cantMin no puede ser mayor que cantMax");
    if (llave.FECHA_INICIO > llave.FECHA_FIN)
      errores.push("fechaInicio no puede ser posterior a fechaFin");
    return errores;
  };

  const whereLlave = (llave) => {
    const where = { COMPANIA: COMPANIA_FR };
    LLAVE.forEach(({ col }) => {
      where[col] = llave[col];
    });
    return where;
  };

  const mismaLlave = (fila, llave) =>
    LLAVE.every(({ col }) => String(fila[col]).trim() === String(llave[col]).trim());

  // Filas de la misma entidad cuyo rango de cantidades y fechas se cruza con `llave`.
  const buscarTraslapes = async (llave, excluir) => {
    const where = { COMPANIA: COMPANIA_FR };
    entidad.forEach((col) => {
      where[col] = llave[col];
    });
    where.CANT_MIN = { [Op.lte]: llave.CANT_MAX };
    where.CANT_MAX = { [Op.gte]: llave.CANT_MIN };
    where.FECHA_INICIO = { [Op.lte]: llave.FECHA_FIN };
    where.FECHA_FIN = { [Op.gte]: llave.FECHA_INICIO };
    const filas = await model.findAll({ where, attributes: ATRIBUTOS, raw: true });
    return excluir ? filas.filter((f) => !mismaLlave(f, excluir)) : filas;
  };

  const describirTraslape = (f) =>
    `ya existe un ${nombre} para ${entidad.map((c) => texto(f[c])).join(" / ")} ` +
    `con cantidades ${f.CANT_MIN}-${f.CANT_MAX} vigente del ${f.FECHA_INICIO} al ${f.FECHA_FIN} ` +
    `que se traslapa con el rango enviado.`;

  // Agrega descripciones de articulo / nombre de cliente a las filas de la pagina.
  const enriquecer = async (filas) => {
    if (!filas.length) return filas;
    const colsArticulo = ["ARTICULO", "ARTICULO_BONIF"].filter(
      (c) => entidad.includes(c) || valores.includes(c)
    );
    const articulos = [
      ...new Set(filas.flatMap((f) => colsArticulo.map((c) => texto(f[c]))).filter(Boolean)),
    ];
    const clientes = entidad.includes("CLIENTE")
      ? [...new Set(filas.map((f) => texto(f.CLIENTE)).filter(Boolean))]
      : [];

    const [arts, clts] = await Promise.all([
      articulos.length
        ? sequelize.query(
            `SELECT COD_ART, DES_ART FROM COAGRO2.erpadmin.ARTICULO WHERE COD_ART IN (:articulos)`,
            { replacements: { articulos }, type: QueryTypes.SELECT }
          )
        : [],
      clientes.length
        ? sequelize.query(
            `SELECT COD_CLT, MAX(NOM_CLT) NOM_CLT FROM COAGRO2.erpadmin.cliente
              WHERE COD_CLT IN (:clientes) GROUP BY COD_CLT`,
            { replacements: { clientes }, type: QueryTypes.SELECT }
          )
        : [],
    ]);
    const desArt = new Map(arts.map((a) => [texto(a.COD_ART), texto(a.DES_ART)]));
    const nomClt = new Map(clts.map((c) => [texto(c.COD_CLT), texto(c.NOM_CLT)]));

    return filas.map((f) => {
      const extra = {};
      if (colsArticulo.includes("ARTICULO"))
        extra.DESCRIPCION_ARTICULO = desArt.get(texto(f.ARTICULO)) || null;
      if (colsArticulo.includes("ARTICULO_BONIF"))
        extra.DESCRIPCION_ARTICULO_BONIF = desArt.get(texto(f.ARTICULO_BONIF)) || null;
      if (entidad.includes("CLIENTE")) extra.NOMBRE_CLIENTE = nomClt.get(texto(f.CLIENTE)) || null;
      return { ...f, ...extra };
    });
  };

  // GET /  ?<entidad camelCase>=  &fecha=YYYY-MM-DD  &vigente=S  &page &limit
  const listar = async (req, res) => {
    try {
      const where = { COMPANIA: COMPANIA_FR };
      entidad.forEach((col) => {
        const v = texto(req.query[dbAJs(col)]);
        if (v) where[col] = v;
      });
      valores
        .filter((c) => c === "ARTICULO_BONIF")
        .forEach((col) => {
          const v = texto(req.query[dbAJs(col)]);
          if (v) where[col] = v;
        });

      let fecha = texto(req.query.fecha);
      if (!fecha && texto(req.query.vigente).toUpperCase() === "S")
        fecha = moment().format("YYYY-MM-DD");
      if (fecha) {
        if (!esFecha(fecha)) return fallo(res, ["fecha debe tener formato YYYY-MM-DD"]);
        where.FECHA_INICIO = { [Op.lte]: fecha };
        where.FECHA_FIN = { [Op.gte]: fecha };
      }

      const { page, limit, offset } = getPaginacion(req.query);
      const data = await model.findAndCountAll({
        where,
        attributes: ATRIBUTOS,
        limit,
        offset,
        order: [...entidad.map((c) => [c, "ASC"]), ["FECHA_INICIO", "DESC"], ["CANT_MIN", "ASC"]],
        raw: true,
      });
      data.rows = await enriquecer(data.rows);
      res.send(respuestaPaginada(data, { page, limit }));
    } catch (error) {
      console.log(error);
      fallo(res, parseErrores(error, `Error al consultar ${nombre}`));
    }
  };

  // GET /<llave>
  const obtener = async (req, res) => {
    try {
      const llave = leerLlave(req.params);
      const errores = validarLlave(llave);
      if (errores.length) return fallo(res, errores);
      const fila = await model.findOne({ where: whereLlave(llave), attributes: ATRIBUTOS, raw: true });
      const [data] = fila ? await enriquecer([fila]) : [null];
      res.send({ result: data, success: true });
    } catch (error) {
      console.log(error);
      fallo(res, parseErrores(error, `Error al consultar ${nombre}`));
    }
  };

  // POST /  body con la entidad, el rango y los valores en camelCase
  const crear = async (req, res) => {
    try {
      const llave = leerLlave(req.body);
      let errores = validarLlave(llave);
      if (errores.length) return fallo(res, errores);

      const vals = tomarValores(req.body);
      errores = [
        ...(await validarEntidad(llave)),
        ...(await validarValores(vals)),
      ];
      if (errores.length) return fallo(res, errores);

      const traslapes = await buscarTraslapes(llave);
      if (traslapes.length) return fallo(res, traslapes.map(describirTraslape));

      await model.create({ COMPANIA: COMPANIA_FR, ...llave, ...vals });
      const fila = await model.findOne({ where: whereLlave(llave), attributes: ATRIBUTOS, raw: true });
      const [data] = await enriquecer([fila]);
      res.send({ result: data, success: true });
    } catch (error) {
      console.log(error);
      fallo(res, parseErrores(error, `Error al crear ${nombre}`));
    }
  };

  // PUT /<llave actual>  body con cantMin/cantMax/fechaInicio/fechaFin y/o valores (parcial)
  const actualizar = async (req, res) => {
    try {
      const llaveActual = leerLlave(req.params);
      let errores = validarLlave(llaveActual);
      if (errores.length) return fallo(res, errores);

      const where = whereLlave(llaveActual);
      const actual = await model.findOne({ where, attributes: ATRIBUTOS, raw: true });
      if (!actual) return fallo(res, [`No existe ese ${nombre}.`]);

      // Llave nueva: la entidad no cambia; el rango toma lo que venga en el body.
      const llaveNueva = { ...llaveActual };
      RANGO.forEach(({ col, param }) => {
        if (req.body[param] !== undefined) llaveNueva[col] = texto(req.body[param]);
      });
      errores = validarLlave(llaveNueva);
      if (errores.length) return fallo(res, errores);

      const cambios = tomarValores(req.body);
      const valoresActuales = {};
      valores.forEach((c) => {
        valoresActuales[c] = actual[c];
      });
      const combinados = { ...valoresActuales, ...cambios };
      errores = await validarValores(combinados);
      if (errores.length) return fallo(res, errores);
      // validarValores puede normalizar (ej TIPO en mayuscula): se respeta en los cambios.
      Object.keys(cambios).forEach((c) => {
        cambios[c] = combinados[c];
      });

      const traslapes = await buscarTraslapes(llaveNueva, llaveActual);
      if (traslapes.length) return fallo(res, traslapes.map(describirTraslape));

      const set = { ...cambios };
      RANGO.forEach(({ col }) => {
        if (llaveNueva[col] !== llaveActual[col]) set[col] = llaveNueva[col];
      });
      if (Object.keys(set).length) await model.update(set, { where });

      const fila = await model.findOne({
        where: whereLlave(llaveNueva),
        attributes: ATRIBUTOS,
        raw: true,
      });
      const [data] = await enriquecer([fila]);
      res.send({ result: data, success: true });
    } catch (error) {
      console.log(error);
      fallo(res, parseErrores(error, `Error al actualizar ${nombre}`));
    }
  };

  // DELETE /<llave>
  const eliminar = async (req, res) => {
    try {
      const llave = leerLlave(req.params);
      const errores = validarLlave(llave);
      if (errores.length) return fallo(res, errores);
      const data = await model.destroy({ where: whereLlave(llave) });
      if (!data) return fallo(res, [`No existe ese ${nombre}.`]);
      res.send({ result: data, success: true });
    } catch (error) {
      console.log(error);
      fallo(res, parseErrores(error, `Error al eliminar ${nombre}`));
    }
  };

  return { llavePath, listar, obtener, crear, actualizar, eliminar };
};

module.exports = {
  COMPANIA_FR,
  crearCrudDescuento,
  existeArticulo,
  validarClienteArticulo,
  validarNivelArticulo,
  validarNumero,
};
