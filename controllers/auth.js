const { matchedData } = require("express-validator");
const {
  tokenSign,
  tokenSignReset,
  verifyTokenReset,
  verifyToken,
  tokenLoginCode,
} = require("../utils/handleJwt");
const { handleHttpError } = require("../utils/handleError");
const {
  clienteModel,
  consecutivoModel,
  clieVenModel,
  usuarioModel,
} = require("../models");
const { compare, encrypt } = require("../utils/handlePassword");
const { sequelize } = require("../config/mssql");
const { QueryTypes, where } = require("sequelize");
const { transporter } = require("./../config/mailer");
const e = require("express");
const { raw } = require("body-parser");

const host = process.env.HOST;
const ssl = process.env.SSL;
const registerCtrl = async (req, res) => {
  try {
    const _email = req.body.email;
    const _nombres = req.body.nombres;
    const _PASSWORD = await encrypt(req.body.password);
    const _rol = req.body.rol;
    const cliente = req.cliente;
    var today = new Date();
    const Usuario = {
      email: _email,
      nombres: _nombres,
      activo: true,
      rol: _rol,
      password: _PASSWORD,
      empresa: cliente[0].empresa,
    };

    // validamos si el correo ya existe

    const existEmail = await sequelize.query(
      `select email from dte.dbo.usuario where upper(email)=upper('${_email}') and empresa=${cliente[0].empresa}`,
      {
        type: QueryTypes.SELECT,
      }
    );

    if (existEmail.length === 0) {
      const crearUser = await sequelize.query(
        `insert into dte.dbo.usuario(email,nombres,activo,rol,password,confirm,empresa) values('${_email}',upper('${_nombres}'),1,'${_rol}','${_PASSWORD}',1,${cliente[0].empresa}) `,

        {
          type: QueryTypes.SELECT,
        }
      );

      res.send({
        results: { message: "El Correo se Registro con Existo" },
        success: true,
        error: "",
      });
    } else {
      res.send({
        results: { message: "Ya existe" },
        success: false,
        errors: ["El Correo Ya Fue registrado"],
      });
    }
  } catch (error) {
    console.log(error);
    handleHttpError(res, "ERROR REGISTANDO UN CLIENTE");
  }
};
/**
 * Este Controlador es el encargado de logear un Cliente
 * @param {*} req
 * @param {*} res
 */
const loginCtrl = async (req, res) => {
  try {
    const _email = req.body.email;
    const _password = req.body.password;
    const _empresa = req.body.empresa;
    const datausuario = await sequelize.query(
      //`select usuario_id,email,nombres,activo,confirm,rol,password,empresa from dte.dbo.usuario where upper(email)=upper('${_email}') and empresa=${_empresa}`,
      `select u.usuario_id,u.email,u.nombres,u.activo,u.confirm,u.rol,u.password,u.empresa,e.nombre as empresaNombre from dte.dbo.usuario u, dte.dbo.empresa e where  u.empresa=e.Empresa_id and upper( u.email)=upper( '${_email}') and u.empresa=${_empresa}`,

      {
        type: QueryTypes.SELECT,
      }
    );

    if (datausuario.length == 0) {
      return res.send({
        result: {},
        success: false,
        errors: ["Usuario no existe "],
      });
    }

    for (let i = 0; i < datausuario.length; i++) {
      const element = datausuario[i];

      if (element.confirm == 0) {
        return res.send({
          result: {},
          success: false,
          errors: ["Cuenta no esta Activa"],
        });
      }

      const hashPassword = element.password;

      const check = await compare(_password, hashPassword);
      if (!check) {
        return res.send({
          result: {},
          success: false,
          errors: ["PASSWORD INVALIDO"],
        });
      }

      // datausuario[0].set("password", undefined, { strict: false });
      nuevo = JSON.stringify(datausuario[0]);
      nuevo = JSON.parse(nuevo);

      const result = {
        token: await tokenSign(nuevo),
        usuario: nuevo,
      };

      res.send({
        result,
        success: true,
        errors: "Se envio con existo",
      });
    }
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      Success: false,
      Errors: ["Error a Logear a un cliente"],
    });
  }
};
const loginCodigo = async (req, res) => {
  try {
    req = matchedData(req);

    const cliente = await clienteModel.findAll({
      attributes: [
        "CLIENTE",
        "NOMBRE",
        "CONTRIBUYENTE",
        "RUBRO1_CLI",
        "RUBRO2_CLI",
        "Rol",
        "Password",
        "Nivel_Precio",
        "Direccion",
        "Telefono1",
        "E_Mail",
        "CONFIRN",
      ],
      where: {
        E_Mail: req.E_Mail,
      },
    });

    if (cliente.length == 0) {
      handleHttpError(res, "Cliente No Existe", 404);
      return;
    }

    for (let i = 0; i < cliente.length; i++) {
      const element = cliente[i];

      if (element.CONFIRN == 0) {
        return res.send({
          results: { message: "Cuenta no esta Activa" },
          result: false,
          error: "",
        });
      }
      const hashPassword = element.Password;

      const check = await compare(req.Password, hashPassword);
      if (!check) {
        handleHttpError(res, "PASSWORD_INVALID", 401);
        return;
      }

      nuevo = JSON.stringify(cliente[0]);
      nuevo = JSON.parse(nuevo);

      const data = {
        token: await tokenSign(nuevo),
        cliente: nuevo,
      };
      res.send({ data });
    }
  } catch (error) {
    handleHttpError(res, "Error al Logear a un cliente");
  }
};

const forgotPassword = async (req, res) => {
  const email = req.body.email;

  if (!email) {
    return res.status(400).json({ messaje: "Correo es requerido" });
  }
  const message = "Revise su Correo  y click en link para Reset Password";
  let verificactionLink;
  let emailStatus = "Ok";
  try {
    const cliente = await clienteModel.findAll({
      attributes: [
        "CLIENTE",
        "NOMBRE",
        "CONTRIBUYENTE",
        "RUBRO1_CLI",
        "RUBRO2_CLI",
        "Rol",
        "Password",
        "Nivel_Precio",
        "Direccion",
        "Telefono1",
        "E_Mail",
      ],
      where: {
        E_Mail: email,
      },
    });
    const token = await tokenSignReset(cliente);

    let url = string;
    if (ssl == "N") {
      url = `http://${host}/new-password/${token}`;
    } else {
      url = `https://${host}/new-password/${token}`;
    }
    verificactionLink = url;

    //actualizamos token en la base de datos

    const updateToken = await clienteModel.update(
      {
        RESET_TOKEN: token,
      },
      { where: { E_Mail: email } }
    );
  } catch (error) {
    return res.json(error);
  }
  //TODO: send Email
  try {
    //Envio de eamil
    await transporter.sendMail({
      from: '"Soporte Bellmart S.A.de C.V." <no-reply@bellmart.com>', // sender address
      to: email, // list of receivers
      subject: "Recuperacion de Contraseña", // Subject line
      html: `
      <b>Haga click en el siguiente enlace o péguelo en su navegador para completar el proceso:</b>
      <a href="${verificactionLink}">${verificactionLink}</a>
      `, // html body
    });
  } catch (error) {
    emailStatus = error;
    return res
      .status(400)
      .send({ message: "Existen un Problema en el Proceso" });
  }

  res.send({ message, info: emailStatus });
  //res.send(verificactionLink);
};
const createNewPass = async (req, res) => {
  const { newPassword } = req.body;
  const resetToken = req.headers.reset;
  if (!(resetToken && newPassword)) {
    res.status(400).send({ message: "Todos los mensajes son requeridos" });
  }
  let jwtPayload;
  try {
    jwtPayload = await verifyTokenReset(resetToken);
    if (!jwtPayload) {
      return res
        .status(401)
        .send({ message: "El tiempo para realizar cambio ha expirado" });
    }
    const user = await clienteModel.findOne({
      where: { RESET_TOKEN: resetToken },
    });
    // realizamos cambio de password nuevo
    const PASSWORD = await encrypt(newPassword);

    const updatePassword = await clienteModel.update(
      {
        Password: PASSWORD,
      },
      { where: { E_Mail: user.E_Mail } }
    );

    res.send({ message: "Pasword se cambio con existo" });
  } catch (error) {
    return res.status(401).send({ message: "Algo no ha ido Bien" });
  }
};
const changePass = async (req, res) => {
  const cliente = req.cliente;
  const { oldPassword, newPassword } = req.body;
  if (!(oldPassword && newPassword)) {
    res.status(400).send({ message: "Antiguo y Nuevo Password son requerido" });
  }

  try {
    const dataCliente = await clienteModel.findOne({
      where: { CLIENTE: cliente.CLIENTE },
    });
    const encriptar = await compare(oldPassword, dataCliente.Password);
    if (!encriptar) {
      return res.status(401).send({ message: "Cheque el Password Antiguo" });
    }
    //procedemos a cambiar password nuevo
    const nuevoPassword = await encrypt(newPassword);

    const updateNewPassword = clienteModel.update(
      { Password: nuevoPassword },
      { where: { CLIENTE: cliente.CLIENTE } }
    );

    res.send({
      message: "Cambio de Clave con existo",
    });
  } catch (error) {
    res.status(400).send({ message: error });
  }
};
const activarCliente = async (req, res) => {
  const token = req.params.token;

  let jwtPayload;
  try {
    jwtPayload = await verifyToken(token);
    if (!jwtPayload) {
      return res
        .status(401)
        .send({ message: "El tiempo para realizar cambio ha expirado" });
    }
    const user = await usuarioModel.update(
      { confirm: 1 },
      {
        where: { confirm_token: token },
      }
    );

    res.send({
      results: { message: "Se activo con existo su cuenta" },
      result: true,
      error: "",
    });
  } catch (error) {
    res.send({
      results: { messegae: "Existe un Error" },
      result: false,
      errors: error,
    });
  }
};
const generarCodigo = async (req, res) => {
  const email = req.body.email;
  //console.log(email);
  const cliente = await clienteModel.findAll({
    attributes: ["CLIENTE", "E_Mail", "NOMBRE", "CONFIRN"],

    where: {
      E_Mail: email,
    },
  });

  if (cliente.length == 0) {
    return res.send({
      results: { results: { mensage: "Cliente No existe" } },
      result: true,
      error: "",
    });
  }
  for (let i = 0; i < cliente.length; i++) {
    const element = cliente[i];
    if (element.CONFIRN == 0) {
      return res.send({
        results: { message: "Cuenta no esta Activa" },
        result: false,
        error: "",
      });
    }
    let code = "";
    for (let index = 0; index <= 5; index++) {
      let character = Math.ceil(Math.random() * 9);
      code += character;
    }
    const data = {
      CLIENTE: element.CLIENTE,
      NOMBRE: element.NOMBRE,
      EMAIL: email,
      CODE: code,
    };
    //Actualizamos al cliente con el codigo
    const tokenCode = await tokenLoginCode(data);
    const user = await clienteModel.update(
      { LOGIN_CODE: tokenCode },
      {
        where: { E_Mail: email },
      }
    );
    try {
      //Envio de eamil
      await transporter.sendMail({
        from: '"Soporte Bellmart S.A.de C.V." <no-reply@bellmart.com>', // sender address
        to: email, // list of receivers
        subject: "Su clave de acesso es :" + code, // Subject line
        attachments: [],
        html: `
      <div style="box-sizing:border-box;width:100%;height:100%;margin:0;padding:0;background:#f1f1f1!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"> 
      <table align="center" bgcolor="#ffffff" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:650px;border:1px solid #eaeaea;table-layout:auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"> 
      <tbody>
      <tr>
        <td align="center" bgcolor="#ff8f80" height="20" style="height:10px"></td>
      </tr>
      <tr>
        <td align="center" bgcolor="#ff8f80" height="20" style="height:10px"></td>
      </tr>
      <tr>
      <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"> 
        <tbody>
          <tr> 
            <td align="center"> 
              <img style="width:38%;text-align:center;margin-top:5%" src="https://ci5.googleusercontent.com/proxy/1aQi4kAtK63mfetU-gw61kIbn36Eg9u-9H8iYXaTpieZG2WK4xJDQVu0XCVfvjUVuwGjDObz0q3gEfLQdi5HDLOvk76X75Mw-w=s0-d-e1-ft#https://xclaim.vtexassets.com/arquivos/logo_xclaim.png" alt="XCLAIM" class="CToWUd a6T" data-bit="iit" tabindex="0">
                <div class="a6S" dir="ltr" style="opacity: 0.01; left: 613.538px; top: 121.5px;"><div id=":30x" class="T-I J-J5-Ji aQv T-I-ax7 L3 a5q" role="button" tabindex="0" aria-label="Descargar el archivo adjunto " jslog="91252; u014N:cOuCgd,Kr2w4b,xr6bB; 4:WyIjbXNnLWY6MTc3OTYwMjA5NDg3NTE1NDQ0OCIsbnVsbCxbXSxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxbXSxbXSxbXV0." data-tooltip-class="a1V" jsaction="JIbuQc:.CLIENT" data-tooltip="Descargar">
                  <div class="akn"><div class="aSK J-J5-Ji aYr"></div>
                </div>
                </div>
                </div> 
            </td> 
          </tr>
        </tbody>
      </table>
    </td>
    </tr>
    <tr>
      <td align="center">
      <table cellspacing="0" style="border-collapse:collapse;width:100%;color:#333333"> 
        <tbody>
          <tr> 
            <td style="height:90px;padding:0px 20px"> 
              <p style="font-size:24px;font-weight:600;padding-top:43px;color:#1f1f1f;text-align:center">¡Hola, ${element.NOMBRE}!</p> 
              <p style="font-size:22px;font-weight:600;padding-top:0px;color:#1f1f1f;text-align:center">Su clave de acceso es:</p> 
              <p style="font-size:51px;font-weight:600;padding-top:30px;padding-bottom:30px;color:#ff8f80;text-align:center">${code}</p> 
              <p style="color:#969696;text-align:center">Regrese a la página de login e ingrese el código de arriba para confirmar su identidad.</p> 
              <p style="color:#969696;text-align:center;font-weight:bold">Atentamente Equipo BELLMART</p> 
            </td> 
          </tr> 
        </tbody>
      </table>
      </td>
    </tr>
    <tr> 
      <td bgcolor="#FFFFFF" style="box-sizing:border-box;padding:0px 15px 15px 15px"> </td> 
    </tr>
    <tr align="right" style="text-align:right">
    <td align="right" bgcolor="#ffffff" height="10" style="padding:5px 10px 5px 0;background:#fff"> 
  
    <table border="0" cellpadding="0" cellspacing="0" style="font-size:12px" width="90%"> 
      <tbody>
        <tr>
          <td>
            <span style="text-align:right;margin-right:4px"> <a href="https://www.facebook.com/Xclaim" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://www.facebook.com/Xclaim&amp;source=gmail&amp;ust=1697295762917000&amp;usg=AOvVaw2LfY2ixLfF9RJYeUUT9zE8"> 
            <img style="width:4%;text-align:center" src="https://ci4.googleusercontent.com/proxy/1na_zVBv3gGE55W3Gfwm9YZVh3bRtOgoyBVrDwQZxeuB-rNPZb3QPzCCplHxwpYmROrJZfxSENnp8EoYigLVV7r88Bq-fqhwWTiYJJ0d1zNeXx43KpZ1MWJB6pmNbH3sz_ZfJukQ4lXLWgPMqjwGxSSe721e_u7CGGxwOPVmBCTzrSMv=s0-d-e1-ft#https://xclaim.vtexassets.com/assets/vtex/assets-builder/xclaim.store-theme/0.2.3/facebook___2962483%E2%80%A6.png" alt="Xclaim" class="CToWUd" data-bit="iit"></a> </span> 
            <span style="text-align:right;margin-right:4px"> <a href="https://www.instagram.com/xclaimsv/" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://www.instagram.com/xclaimsv/&amp;source=gmail&amp;ust=1697295762917000&amp;usg=AOvVaw094Ziyeo5uBuX9mDwIhLxu">
            <img style="width:4%;text-align:center" src="https://ci3.googleusercontent.com/proxy/fn__xxCnQHFdDcTjf5XEjBeVY4pAWXmK3UcIfhfo6NTg-fJxSzkNkXCP8UCL_zQh0R__gA3Cr_2O7tu5C6-eA0I4frZTdNM_89lMnVREn0ynLUybJCG57A97x093sYPcDvs4FLrsi30bqhFlm_H_RuZiHkfk0UQhJwzIymYfXYB0QrH1zIOaS14oQjiIqWDRdKa3cTOu=s0-d-e1-ft#https://xclaim.vtexassets.com/assets/vtex/assets-builder/xclaim.store-theme/0.2.3/instagram___9dee60236a2bbfca7c85f1b8c6ff820c.png" alt="Xclaim" class="CToWUd" data-bit="iit"></a> 
            </span> 
          </td>
        </tr>
      </tbody>
    </table> 
    </td> 
  </tr>
  <tr> 
    <td align="center" bgcolor="#ff8f80" height="20" style="height:20px"></td> 
  </tr>
  </tbody>
  </table>
  </div>       
      `, // html body
      });
    } catch (error) {
      emailStatus = error;
      return res.status(400).send({
        results: { results: { message: "Existe un problema en el proceso" } },
        result: false,
        error: emailStatus,
      });
    }

    res.send({
      results: { results: { message: "Codigo se envio con exito" } },
      result: true,
      error: "",
    });
  }
  //generarmos el codigo aletorio de 6
};
const validarCode = async (req, res) => {
  const code = req.body.codigo;
  const email = req.body.email;
  //Consultamos el Token del codigo si esta activo aun
  const cliente = await clienteModel.findAll({
    attributes: ["CLIENTE", "E_Mail", "NOMBRE", "CONFIRN", "LOGIN_CODE"],

    where: {
      E_Mail: email,
    },
  });

  if (cliente.length == 0) {
    return res.send({
      results: { results: { mensage: "Cliente No existe" } },
      result: true,
      error: "",
    });
  }
  for (let i = 0; i < cliente.length; i++) {
    const element = cliente[i];
    if (element.CONFIRN == 0) {
      return res.send({
        results: { message: "Cuenta no esta Activa" },
        result: false,
        error: "",
      });
    }
    //vemos si el token esta activo aun
    let jwtPayload;

    jwtPayload = await verifyToken(element.LOGIN_CODE);
    const codeToken = jwtPayload.code;
    if (!jwtPayload) {
      return res.status(401).send({
        results: { message: "El token se se vencio" },
        result: false,
        error: "",
      });
    }

    //Comparamos
    if (code == codeToken) {
      return res.send({
        results: { message: "Codigo es igual" },
        result: true,
        error: "",
      });
    } else {
      return res.send({
        results: { message: "Codigo No es igual a registrado" },
        result: false,
        error: "",
      });
    }
  }

  res.send({
    results: code,
    result: true,
    error: "",
  });
};
const editarCliente = async (req, res) => {
  try {
    const nombres = req.body.nombres;
    const apellidos = req.body.apellidos;
    const documento = req.body.documento;
    const genero = req.body.genero;
    const fechaNacimineto = req.body.fechaNacimineto;
    const recibirboletin = req.body.recibirboletin;
    const telefono = req.body.telefono;
    const cliente = req.cliente;
    const codigo = req.cliente.CLIENTE;
    const nombre = req.body.nombres + " " + req.body.apellidos;

    const actu = await clienteModel.update(
      {
        NOMBRES: nombres,
        APELLIDOS: apellidos,
        RUBRO3_CLI: documento,
        RUBRO4_CLI: genero,
        RUBRO5_CLI: fechaNacimineto,
        RECIBIR_BOLETIN: recibirboletin,
        NOMBRE: nombre,
        TELEFONO1: telefono,
      },
      { where: { CLIENTE: codigo } }
    );

    res.send({
      results: actu,
      result: true,
      error: "",
    });
  } catch (error) {
    res.send({
      results: error,
      result: false,
      error: error,
    });
  }
};
const dirClienteNew = async (req, res) => {};
const dirClienteUpdate = async (req, res) => {};
const listarUser = async (req, res) => {
  const cliente = req.cliente;
  try {
    const listUser = await sequelize.query(
      `select * from dte.dbo.usuario where empresa=${cliente[0].empresa} `,
      {
        type: QueryTypes.SELECT,
      }
    );
    res.send({
      result: listUser,
      success: true,
      error: "",
    });
  } catch (error) {
    console.log(error);
  }
};
module.exports = {
  registerCtrl,
  loginCtrl,
  loginCodigo,
  forgotPassword,
  createNewPass,
  changePass,
  activarCliente,
  generarCodigo,
  validarCode,
  editarCliente,
  dirClienteNew,
  dirClienteUpdate,
  listarUser,
};
