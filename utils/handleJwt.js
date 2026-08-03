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
  verifyToken,
  tokenSignReset,
  verifyTokenReset,
  tokenActiveCliente,
  tokenLoginCode,
};
