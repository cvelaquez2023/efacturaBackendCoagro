const { handleHttpError } = require("../utils/handleError");
const { verifyToken } = require("../utils/handleJwt");
const { clienteModel } = require("../models");
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");

const authMiddleware = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.send({
        result: {},
        success: false,
        errors: ["No existe la session"],
      });
    }
    const token = req.headers.authorization.split(" ").pop();

    const dataToken = await verifyToken(token);

    if (!dataToken.email) {
      return res.send({
        result: {},
        success: false,
        errors: ["Error en Token"],
      });
    }

    const cliente = await sequelize.query(
      `select usuario_id,email,nombres,activo,confirm,rol,password,empresa from dte.dbo.usuario where upper(email)=upper('${dataToken.email}') and empresa=${dataToken.empresa}`,

      {
        type: QueryTypes.SELECT,
      }
    );
       
    nuevo = JSON.stringify(cliente);
    nuevo = JSON.parse(nuevo);

    req.cliente = nuevo;
    next();
  } catch (error) {
    handleHttpError(res, "NOT_SESSION", 401);
  }
};
module.exports = authMiddleware;
