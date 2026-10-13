//
// Usuarios de la app movil (handheld). Rol "RUTA" en dte.dbo.usuario.
//
// Flujo:
//   1) La app (SQLite vacio) pide handheld + URL del servidor y se registra:
//        POST /fr/mobile/registro  -> usuario con confirm = 0 (pendiente)
//   2) El Admin lo aprueba desde la web:
//        GET  /fr/usuarioMovil?estado=pendiente
//        PUT  /fr/usuarioMovil/:id/aprobar
//   3) La app hace login (necesita internet) y recibe el token + sus rutas:
//        POST /fr/mobile/login
//   4) Con el token sincroniza: GET /fr/sync/* y GET /fr/mobile/sesion
//      (middleware/mobileSession.js autentica + checkRol(["RUTA"]) autoriza)
//
// Cualquier usuario RUTA aprobado puede entrar en cualquier handheld: la ruta
// sale de la handheld (RUTA_ASIGNADA_RT), no del usuario.

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const { encrypt, compare } = require("../../utils/handlePassword");
const { tokenSignMobile, MOBILE_TOKEN_EXPIRES } = require("../../utils/handleJwt");
const { resolverHandheld } = require("../../utils/handheldMobile");
const { getPaginacion } = require("../../utils/paginacion");

const ROL_MOBILE = "RUTA";
// Empresa de dte.dbo.empresa a la que pertenecen los usuarios de la app (1 = COAGRO).
const EMPRESA_MOBILE = parseInt(process.env.MOBILE_EMPRESA || "1", 10);
const PASSWORD_MIN = 6;

const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

// POST /fr/mobile/registro
// { email, nombres, password, handheld }
// Crea el usuario PENDIENTE de aprobacion. La handheld se valida para que solo
// un equipo configurado con un codigo real pueda registrar usuarios.
const postRegistro = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    const nombres = String(req.body.nombres || "").trim();
    const password = String(req.body.password || "");

    if (!email || !nombres || !password || !req.body.handheld) {
      return error(res, "Los campos email, nombres, password y handheld son obligatorios");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
      return error(res, "El email no es valido");
    }
    if (nombres.length > 250) return error(res, "El nombre debe tener un maximo de 250 caracteres");
    if (password.length < PASSWORD_MIN) {
      return error(res, `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres`);
    }

    const hh = await resolverHandheld(req.body.handheld);
    if (hh.error) return error(res, hh.error);

    const [existe] = await sequelize.query(
      `SELECT usuario_id FROM dte.dbo.usuario WHERE UPPER(email) = UPPER(:email) AND empresa = :empresa`,
      { replacements: { email, empresa: EMPRESA_MOBILE }, type: QueryTypes.SELECT }
    );
    if (existe) return error(res, "Ese correo ya esta registrado");

    await sequelize.query(
      `INSERT INTO dte.dbo.usuario (email, nombres, activo, rol, password, confirm, empresa)
       VALUES (:email, UPPER(:nombres), 1, :rol, :password, 0, :empresa)`,
      {
        replacements: {
          email,
          nombres,
          rol: ROL_MOBILE,
          password: await encrypt(password),
          empresa: EMPRESA_MOBILE,
        },
        type: QueryTypes.INSERT,
      }
    );

    res.send({
      result: { email, estado: "pendiente" },
      success: true,
      errors: [],
      message: "Registro enviado. Un administrador debe aprobar tu cuenta antes de iniciar sesion.",
    });
  } catch (err) {
    console.log(err);
    error(res, "Error al registrar el usuario");
  }
};

// POST /fr/mobile/login
// { email, password, handheld }
// Devuelve el token (header Authorization: Bearer <token> en /fr/sync/*), el
// usuario y las rutas de la handheld para crear la BD local.
const postLogin = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    if (!email || !password || !req.body.handheld) {
      return error(res, "Los campos email, password y handheld son obligatorios");
    }

    const [usuario] = await sequelize.query(
      `SELECT usuario_id, email, nombres, rol, activo, confirm, empresa, password
         FROM dte.dbo.usuario WHERE UPPER(email) = UPPER(:email) AND empresa = :empresa`,
      { replacements: { email, empresa: EMPRESA_MOBILE }, type: QueryTypes.SELECT }
    );
    // Mismo mensaje si no existe o si la contrasena falla: no revelar que correos existen.
    if (!usuario || !(await compare(password, usuario.password))) {
      return error(res, "Correo o contrasena incorrectos");
    }
    if (usuario.rol !== ROL_MOBILE) return error(res, "Este usuario no tiene acceso a la app de rutas");
    if (!usuario.confirm) return error(res, "Tu cuenta esta pendiente de aprobacion por un administrador");
    if (!usuario.activo) return error(res, "Tu usuario esta desactivado");

    const hh = await resolverHandheld(req.body.handheld);
    if (hh.error) return error(res, hh.error);

    delete usuario.password;
    res.send({
      result: {
        token: await tokenSignMobile(usuario, hh.handheld.HANDHELD),
        expiraEn: MOBILE_TOKEN_EXPIRES,
        usuario: {
          usuario_id: usuario.usuario_id,
          email: usuario.email,
          nombres: usuario.nombres,
          rol: usuario.rol,
        },
        handheld: hh.handheld,
        rutas: hh.rutas,
      },
      success: true,
      errors: [],
    });
  } catch (err) {
    console.log(err);
    error(res, "Error al iniciar sesion");
  }
};

// GET /fr/mobile/sesion   (header Authorization: Bearer <token movil>)
// La app lo llama al recuperar conexion: confirma que el token sigue valido y
// devuelve las rutas actuales de la handheld (pudieron cambiar en la web).
// Si el token vencio o el usuario fue desactivado, mobileSession responde 401.
const getSesion = async (req, res) => {
  const { usuario, handheld, rutas } = req.mobile;
  res.send({
    result: {
      usuario: {
        usuario_id: usuario.usuario_id,
        email: usuario.email,
        nombres: usuario.nombres,
        rol: usuario.rol,
      },
      handheld,
      rutas,
    },
    success: true,
    errors: [],
  });
};

// ---------------------------------------------------------------------------
// Administracion (web, rol Admin)
// ---------------------------------------------------------------------------

// GET /fr/usuarioMovil?estado=pendiente|aprobado&q=texto&page=1&limit=20
const getUsuariosMovil = async (req, res) => {
  try {
    const { estado, q } = req.query;
    const { page, limit, offset } = getPaginacion(req.query);

    const filtros = ["rol = :rol", "empresa = :empresa"];
    if (estado === "pendiente") filtros.push("confirm = 0");
    if (estado === "aprobado") filtros.push("confirm = 1");
    if (q) filtros.push("(email LIKE :q OR nombres LIKE :q)");
    const where = filtros.join(" AND ");
    const replacements = {
      rol: ROL_MOBILE,
      empresa: req.cliente[0].empresa,
      q: `%${q || ""}%`,
      offset,
      limit,
    };

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) total FROM dte.dbo.usuario WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );
    const rows = await sequelize.query(
      `SELECT usuario_id, email, nombres, rol, activo, confirm
         FROM dte.dbo.usuario WHERE ${where}
        ORDER BY confirm, usuario_id DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.send({
      result: rows,
      success: true,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (err) {
    console.log(err);
    error(res, "Error al consultar los usuarios moviles");
  }
};

// Actualiza un usuario RUTA de la empresa del Admin. Devuelve false si no existe.
const actualizarUsuarioMovil = async (req, set) => {
  const [, filas] = await sequelize.query(
    `UPDATE dte.dbo.usuario SET ${set}
      WHERE usuario_id = :id AND rol = :rol AND empresa = :empresa`,
    {
      replacements: { id: req.params.id, rol: ROL_MOBILE, empresa: req.cliente[0].empresa },
      type: QueryTypes.UPDATE,
    }
  );
  return filas > 0;
};

// PUT /fr/usuarioMovil/:id/aprobar
const putAprobarUsuarioMovil = async (req, res) => {
  try {
    if (!(await actualizarUsuarioMovil(req, "confirm = 1"))) {
      return error(res, "No existe un usuario movil con ese id");
    }
    res.send({ result: { usuario_id: req.params.id, confirm: true }, success: true, errors: [] });
  } catch (err) {
    console.log(err);
    error(res, "Error al aprobar el usuario movil");
  }
};

// PUT /fr/usuarioMovil/:id/activo   { activo: true | false }
// Desactivar corta la sync de inmediato aunque el token de la app no haya vencido.
const putActivoUsuarioMovil = async (req, res) => {
  try {
    if (typeof req.body.activo !== "boolean") return error(res, "El campo activo debe ser true o false");
    const set = req.body.activo ? "activo = 1" : "activo = 0";
    if (!(await actualizarUsuarioMovil(req, set))) {
      return error(res, "No existe un usuario movil con ese id");
    }
    res.send({ result: { usuario_id: req.params.id, activo: req.body.activo }, success: true, errors: [] });
  } catch (err) {
    console.log(err);
    error(res, "Error al actualizar el usuario movil");
  }
};

// DELETE /fr/usuarioMovil/:id   -> rechaza un registro PENDIENTE (los aprobados se desactivan)
const deleteUsuarioMovil = async (req, res) => {
  try {
    // OUTPUT devuelve las filas borradas (QueryTypes.DELETE no trae el conteo en mssql).
    const borrados = await sequelize.query(
      `DELETE FROM dte.dbo.usuario OUTPUT DELETED.usuario_id
        WHERE usuario_id = :id AND rol = :rol AND empresa = :empresa AND confirm = 0`,
      {
        replacements: { id: req.params.id, rol: ROL_MOBILE, empresa: req.cliente[0].empresa },
        type: QueryTypes.SELECT,
      }
    );
    if (!borrados.length) return error(res, "Solo se pueden rechazar registros pendientes de aprobacion");
    res.send({ result: { usuario_id: req.params.id }, success: true, errors: [] });
  } catch (err) {
    console.log(err);
    error(res, "Error al rechazar el usuario movil");
  }
};

module.exports = {
  postRegistro,
  postLogin,
  getSesion,
  getUsuariosMovil,
  putAprobarUsuarioMovil,
  putActivoUsuarioMovil,
  deleteUsuarioMovil,
};
