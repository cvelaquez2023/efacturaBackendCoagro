const { check } = require("express-validator");
const validationResults = require("../utils/handleValidator");

const validatorRegisterItem = [
  check("NOMBRE").exists().notEmpty().isLength({ min: 3, max: 99 }),
  check("Direccion").exists().notEmpty().isLength({ min: 3, max: 99 }),
  check("Telefono").exists().notEmpty().isLength({ min: 8, max: 12 }),
  check("Password").exists().notEmpty().isLength({ min: 3, max: 15 }),
  check("Rol").exists().notEmpty(),
  check("E_Mail").exists().notEmpty().isEmail(),
  check("Consecutivo").exists().notEmpty(),
  (req, res, next) => {
    return validationResults(req, res, next);
  },
];
const validatorLogin = [
  check("E_Mail").exists().notEmpty().isEmail(),
  check("Password").exists().notEmpty().isLength({ min: 3, max: 15 }),

  (req, res, next) => {
    return validationResults(req, res, next);
  },
];
const validatorLoginCodigo = [
  check("E_Mail").exists().notEmpty().isEmail(),
  check("Codigo").exists().notEmpty().isLength({ min: 3, max: 15 }),

  (req, res, next) => {
    return validationResults(req, res, next);
  },
];

module.exports = {
  validatorRegisterItem,
  validatorLogin,
  validatorLoginCodigo,
};
