const { check } = require("express-validator");
const validateResults = require("../utils/handleValidator");
const validatorItem = [
  check("bodega").exists().notEmpty(),
  check("nivelPrecio").exists().notEmpty(),
  (req, res, next) => {
    return validateResults(req, res, next);
  },
];
const PutItem = [
  //  check("GALERIA_IMAGENES").exists().notEmpty(),
  check("IMAGEN_VERTICAL").exists().notEmpty(),
  check("IMAGEN_HORIZONTAL").exists().notEmpty(),
  check("IMAGEN").exists().notEmpty(),
  check("ESPECIFICACIONES").exists().notEmpty(),
  (req, res, next) => {
    return validateResults(req, res, next);
  },
];

module.exports = { validatorItem, PutItem };
