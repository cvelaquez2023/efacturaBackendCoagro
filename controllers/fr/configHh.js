const { Op } = require("sequelize");
const { configHhModel, handheldRtModel } = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

// Columnas de configuracion (todo lo que no es HANDHELD/CONSTANTE), en el orden
// del INFORMATION_SCHEMA real. El body llega en camelCase (ej gpsDistanciaM) y se
// mapea a la columna real (GPS_DISTANCIA_M) con dbAJs, igual que rutaConsecutRt.
const COLUMNAS = [
  "VALOR",
  "SIMBOLO_MONEDA",
  "NOMBRE_ARCHIVO_BITACORA",
  "REGISTRO_MULTIPLE_DOCUMENTO",
  "CANTIDAD_DECIMALES",
  "TAMANO_LETRA_WM",
  "DECIMALES_UNIDADES",
  "LIMPIADO_FILTRO_ARTICULOS_ANDROID",
  "INFORMACION_DESCUENTOS_VENCIDA",
  "SELECCION_AUTOMATICA_CLIENTE_WM",
  "BUSQUEDA_AGIL_CLIENTE_WM",
  "ORDENAR_ARTICULO_CRITERIO_WM",
  "ORDENAR_ARTICULO_INDICE_WM",
  "ADVERTIR_ACTUALIZACION",
  "PURGA_AUTOMATICA",
  "PURGA_MANUAL",
  "PURGA_CANTIDAD_DIAS",
  "GPS_UBICACION_VISITA",
  "GPS_UBICACION_CLIENTE",
  "GPS_ACTUALIZAR_UBICACION_CLIENTE",
  "GPS_NO_DETENER_PROCESO_WM",
  "GPS_DISTANCIA_M",
];

// GPS_ACTUALIZAR_UBICACION_CLIENTE -> gpsActualizarUbicacionCliente
const dbAJs = (columna) =>
  columna.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const tomarColumnas = (body) => {
  const valores = {};
  COLUMNAS.forEach((columna) => {
    const valor = body[dbAJs(columna)];
    if (valor !== undefined) valores[columna] = valor;
  });
  return valores;
};

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido para esa columna (ver largos en models/fr/ConfigHh.js).",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Esa handheld ya tiene esa constante configurada."];
  }
  return [fallback];
};

// GET /fr/configHh?handheld=&constante=&page=1&limit=20
// constante filtra por coincidencia parcial.
const getConfigsHh = async (req, res) => {
  try {
    const { handheld, constante } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);
    const where = {};
    if (handheld) where.HANDHELD = handheld;
    if (constante) where.CONSTANTE = { [Op.like]: `%${constante}%` };

    const data = await configHhModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["HANDHELD", "ASC"],
        ["CONSTANTE", "ASC"],
      ],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la configuracion de handhelds"),
    });
  }
};

// GET /fr/configHh/:handheld/:constante
const getConfigHh = async (req, res) => {
  const { handheld, constante } = req.params;
  try {
    const data = await configHhModel.findOne({
      where: { HANDHELD: handheld, CONSTANTE: constante },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la configuracion de la handheld"),
    });
  }
};

// POST /fr/configHh
// { handheld, constante, valor, ...resto opcional en camelCase }
// La handheld debe existir en HANDHELD_RT. Una constante no se repite en la misma handheld.
const postConfigHh = async (req, res) => {
  try {
    const { handheld, constante } = req.body;
    if (!handheld || !constante) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos handheld y constante son obligatorios"],
      });
    }

    const handheldRt = await handheldRtModel.findOne({ where: { HANDHELD: handheld }, raw: true });
    if (!handheldRt) {
      return res.send({
        result: {},
        success: false,
        errors: [`La handheld ${handheld} no existe. Dala de alta primero con POST /fr/handheldRt.`],
      });
    }

    const existe = await configHhModel.findOne({
      where: { HANDHELD: handheld, CONSTANTE: constante },
      raw: true,
    });
    if (existe) {
      return res.send({
        result: {},
        success: false,
        errors: [`La handheld ${handheld} ya tiene la constante ${constante}.`],
      });
    }

    const data = await configHhModel.create({
      HANDHELD: handheld,
      CONSTANTE: constante,
      ...tomarColumnas(req.body),
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la configuracion de la handheld"),
    });
  }
};

// PUT /fr/configHh/:handheld/:constante
// Body con cualquier subconjunto de los campos de configuracion (camelCase).
// handheld/constante son la PK: para cambiarlos se borra y se crea de nuevo.
const putConfigHh = async (req, res) => {
  const { handheld, constante } = req.params;
  try {
    const where = { HANDHELD: handheld, CONSTANTE: constante };
    const actual = await configHhModel.findOne({ where, raw: true });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`La handheld ${handheld} no tiene la constante ${constante}.`],
      });
    }

    const data = await configHhModel.update(tomarColumnas(req.body), { where });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la configuracion de la handheld"),
    });
  }
};

// DELETE /fr/configHh/:handheld/:constante
const deleteConfigHh = async (req, res) => {
  const { handheld, constante } = req.params;
  try {
    const data = await configHhModel.destroy({
      where: { HANDHELD: handheld, CONSTANTE: constante },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la configuracion de la handheld"),
    });
  }
};

module.exports = {
  getConfigsHh,
  getConfigHh,
  postConfigHh,
  putConfigHh,
  deleteConfigHh,
};
