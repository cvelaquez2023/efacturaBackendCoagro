const { emailEnviado } = require("../../utils/email");
const { generaPdf, generaPdf05 } = require("../../utils/generaPdf");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");

const envioMail = async (req, res) => {
  try {
    const dte = req.body.dte;
    const _ano=dte.substring(16, 18)
    const _a='-'+_ano+'-'
    const dt01 = dte.replace(_a, "-");
    const tipo = dte.substring(4, 6);
    const tipo00 = "dte" + tipo;
    const correo = req.body.correo;
    const User = req.cliente;
    const _ano2='20'+_ano

    await emailEnviado(dt01, correo, process.env.DTE_CORREO,'Reenvio', tipo00,_ano2,User[0].empresa);
    res.send({ result: "Correo Enviado", success: true });
  } catch (error) {
    await notifyError("envioMail", "envioMail", error, "DTE: " + req.body.dte);
    if (res && !res.headersSent) {
      res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
    }
  }
};

module.exports = envioMail;
