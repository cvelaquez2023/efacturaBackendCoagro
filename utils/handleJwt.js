const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_RESET = process.env.JWT_SECRETRESET;
const tokenSign = async (user) => {
  const sign = jwt.sign(
    {
      email: user.email,
      nombres: user.nombres,
      rol: user.rol,
      activo: user.activo,
      empresa: user.empresa,
    },
    JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

  return sign;
};
// Token de la app movil (handheld). Dura mas que el web porque la app trabaja
// dias sin conexion y solo lo usa al sincronizar. `tipo: "mobile"` evita que
// un token web se use en la sync y viceversa. `firma` es el identificador del
// equipo: mobileSession lo compara con HANDHELD_RT.FIRMA en cada request.
const MOBILE_TOKEN_EXPIRES = process.env.MOBILE_TOKEN_EXPIRES || "30d";
const tokenSignMobile = async (user, handheld, firma) => {
  const sign = jwt.sign(
    {
      tipo: "mobile",
      usuario_id: user.usuario_id,
      email: user.email,
      nombres: user.nombres,
      rol: user.rol,
      empresa: user.empresa,
      handheld,
      firma,
    },
    JWT_SECRET,
    {
      expiresIn: MOBILE_TOKEN_EXPIRES,
    }
  );

  return sign;
};
const tokenActiveCliente = async (user) => {
  const sign = jwt.sign(
    {
      cliente: user.CLIENTE,
      nombre: user.NOMBRE,
      email: user.EMAIL,
    },
    JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

  return sign;
};

const tokenLoginCode = async (user) => {
  const sign = jwt.sign(
    {
      cliente: user.CLIENTE,
      nombre: user.NOMBRE,
      email: user.EMAIL,
      code: user.CODE,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  return sign;
};

const tokenSignReset = async (user) => {
  const sign = jwt.sign(
    {
      cliente: user.CLIENTE,
      nombre: user.NOMBRE,
      rol: user.Rol,
      nivelPrecio: user.Nivel_Precio,
    },
    JWT_SECRET_RESET,
    {
      expiresIn: "10m",
    }
  );

  return sign;
};
/**
 * Debes de pasar el token de session JWT
 * @param {*} tokenJwt
 * @returns
 */
const verifyToken = async (tokenJwt) => {
  try {
    return jwt.verify(tokenJwt, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const verifyTokenReset = async (tokenJwt) => {
  try {
    return jwt.verify(tokenJwt, JWT_SECRET_RESET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  tokenSign,
  tokenSignMobile,
  MOBILE_TOKEN_EXPIRES,
  verifyToken,
  tokenSignReset,
  verifyTokenReset,
  tokenActiveCliente,
  tokenLoginCode,
};
