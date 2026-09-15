const { generaPdf, generaPdf05, generaPdf14, } = require("../../utils/generaPdf");
const { generaPdfTicket } = require("../../utils/pdfMakeTicket");
const { Sqlempresa } = require("../../sqltx/sql");
const logger = require("../../utils/logger");
const { notifyError } = require("../../utils/errorNotifier");

const reimprimir = async (req, res) => {
  try {
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
  } catch (error) {
    await notifyError("reimprimir", "reimprimir", error, "Factura: " + req.body.dte);
    if (res && !res.headersSent) {
      res.status(500).send({ messaje: "Error interno del servidor", result: false, error: error.message });
    }
  }
};

module.exports = reimprimir;
