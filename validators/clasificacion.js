const { check } = require("express-validator");
const validateResults = require("../utils/handleValidator");
const validateUpdate = [
  check("imagen1").exists().notEmpty(),
  check("imagen2").exists().notEmpty(),
  check("imagen3").exists().notEmpty(),
  check("imagen4").exists().notEmpty(),
  check("imagen5").exists().notEmpty(),
  check("Slider").exists().notEmpty(),
  (req, res, next) => {
    return validateResults(req, res, next);
  },
];

module.exports = { validateUpdate };
