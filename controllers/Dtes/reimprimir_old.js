
const { generaPdf, generaPdf05 } = require("../../utils/generaPdf");



const reimprimir = async (req, res) => {
  const factura = req.body.dte;
  const tipo = req.body.tipoDoc;
  if (tipo === "01" || tipo === "03"|| tipo === "11") {
    await generaPdf(factura);
  }
  if (tipo == "05") {
    await generaPdf05(factura);
  }
  res.send({ result: "Se genero el Nuevo PDF", success: true });
};

module.exports =  reimprimir;