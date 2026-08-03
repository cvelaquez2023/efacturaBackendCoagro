const { emailEnviado } = require("../../utils/email");
const { generaPdf, generaPdf05 } = require("../../utils/generaPdf");

const envioMail = async (req, res) => {
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
};

const reimprimir = async (req, res) => {
  const factura = req.body.factura;
  const tipo = req.body.tipoDoc;
  if (tipo === "01" || tipo === "03") {
    await generaPdf(factura);
  }
  if (tipo == "05") {
    await generaPdf05(factura);
  }
  res.send({ result: "Doccumento Generado", success: true });
};

module.exports = envioMail;
