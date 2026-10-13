const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/mssql");
const { verifyToken } = require("../utils/handleJwt");
const { resolverHandheld } = require("../utils/handheldMobile");

/**
 * Sesion de la app movil (handheld). Exige el token de POST /fr/mobile/login
 * en el header `Authorization: Bearer <token>`.
 *
 * Solo autentica: el permiso por rol va despues con checkRol(["RUTA"]), igual
 * que en la web (authMiddleware + checkRol).
 *
 * Cada request vuelve a validar contra la BD que el usuario siga activo y
 * aprobado, y que la handheld siga teniendo rutas asignadas: si el Admin
 * desactiva al usuario o le quita la ruta a la handheld, la sync se corta
 * aunque el token no haya vencido.
 *
 * Responde 401 cuando la app debe volver a hacer login. Deja en req:
 *   cliente: [usuario]                                (mismo formato que authMiddleware, para checkRol)
 *   mobile:  { usuario, handheld, rutas, codigosRuta }
 */
const noAutorizado = (res, mensaje) =>
  res.status(401).send({ result: {}, success: false, errors: [mensaje] });

const mobileSession = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").split(" ").pop();
    if (!token) return noAutorizado(res, "No existe la sesion");

    const dataToken = await verifyToken(token);
    if (!dataToken || dataToken.tipo !== "mobile") {
      return noAutorizado(res, "Sesion vencida o invalida, vuelve a iniciar sesion");
    }

    const [usuario] = await sequelize.query(
      `SELECT usuario_id, email, nombres, rol, activo, confirm, empresa
         FROM dte.dbo.usuario WHERE usuario_id = :id`,
      { replacements: { id: dataToken.usuario_id }, type: QueryTypes.SELECT }
    );
    if (!usuario || !usuario.activo || !usuario.confirm) {
      return noAutorizado(res, "El usuario ya no tiene acceso a la app de rutas");
    }

    const hh = await resolverHandheld(dataToken.handheld);
    if (hh.error) return noAutorizado(res, hh.error);

    req.cliente = [usuario];
    req.mobile = {
      usuario,
      handheld: hh.handheld,
      rutas: hh.rutas,
      codigosRuta: hh.rutas.map((r) => String(r.RUTA).trim()),
    };
    next();
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al validar la sesion"] });
  }
};

module.exports = mobileSession;
