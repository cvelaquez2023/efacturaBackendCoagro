const { generaPdf, generaPdf05, generaPdf14, } = require("../../utils/generaPdf");
const { generaPdfTicket } = require("../../utils/pdfMakeTicket");
const { Sqlempresa } = require("../../sqltx/sql");

const reimprimir = async (req, res) => {
  const factura = req.body.dte;
  const tipo = req.body.tipoDoc;
  const _ano = factura.substring(16, 18);
  const User = req.cliente;
  const _ano2 = "20" + _ano;
  const empresa = await Sqlempresa(User[0].empresa);
  if (tipo === "01" || tipo === "03" || tipo === "11") {
    if (empresa[0].formato === "T") {
      await generaPdfTicket(factura, _ano2, User[0].empresa);
    } else {
      await generaPdf(factura, _ano2, User[0].empresa);
    }
  }
  if (tipo == "05") {
    await generaPdf05(factura, _ano2, User[0].empresa);
  }
 
 if (tipo == "14") {
    await generaPdf14(factura, _ano2, User[0].empresa);
  }
  res.send({ result: "Se genero el Nuevo PDF", success: true });
};

module.exports = reimprimir;
