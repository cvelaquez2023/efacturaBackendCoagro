/**
 * Regenera la representación gráfica (PDF) de un evento de invalidación ya
 * aceptado por Hacienda y, con --enviar, la manda al receptor junto con el
 * archivo del evento (JSON). Usa el JSON guardado en
 * storage/json/<esquema>/invalidaciones/<año>/<numeroControl>.json
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/reenviarInvalidacion.js <numeroControlDte> <Empresa_id>            -> solo genera el PDF
 *   node scripts/reenviarInvalidacion.js <numeroControlDte> <Empresa_id> --enviar   -> genera y envía
 *   Opcional: --correo=otro@dominio.com para enviar a otra dirección.
 *
 * El número de control puede ir con o sin el año interno (DTE-03-M001P001-26-...).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Sqlempresa } = require("../sqltx/sql");
const { numeroControl } = require("../utils/numeroControl");
const { generaPdfInvalidacion, rutasInvalidacion } = require("../utils/eventoInvalidacion");
const { emailInvalidado } = require("../utils/email");

const main = async () => {
  const [, , docArg, empresaArg, ...resto] = process.argv;
  if (!docArg || !empresaArg) {
    console.log("Uso: node scripts/reenviarInvalidacion.js <numeroControlDte> <Empresa_id> [--enviar] [--correo=x@y.com]");
    process.exit(1);
  }
  const enviar = resto.includes("--enviar");
  const correoArg = (resto.find((a) => a.startsWith("--correo=")) || "").replace("--correo=", "");

  const numeroControlDte = numeroControl(docArg);
  const empresa = await Sqlempresa(empresaArg);
  if (!empresa.length) throw new Error(`Empresa ${empresaArg} no existe o no está activa`);
  const esquema = empresa[0].esquemaBD;

  // Busca el JSON del evento en cualquier año
  const base = path.join(__dirname, `../storage/json/${esquema}/invalidaciones`);
  const ano = (fs.existsSync(base) ? fs.readdirSync(base) : []).find((a) =>
    fs.existsSync(path.join(base, a, `${numeroControlDte}.json`))
  );
  if (!ano) throw new Error(`No se encontró el JSON del evento de ${numeroControlDte} en ${base}`);

  const { json, pdf } = rutasInvalidacion(esquema, ano, numeroControlDte);
  const archivo = JSON.parse(fs.readFileSync(json, "utf8"));
  const evento = {
    identificacion: archivo.identificacion,
    emisor: archivo.emisor,
    documento: archivo.documento,
    motivo: archivo.motivo,
  };
  const respuestaMH = archivo.respuestaMh || { selloRecibido: archivo.selloRecibido };
  if (!respuestaMH.selloRecibido) throw new Error("El evento no tiene sello de recepción: no fue aceptado por Hacienda");

  await generaPdfInvalidacion({ esquema, ano, numeroControlDte, evento, respuestaMH, empresa });
  console.log(`PDF generado: ${pdf}`);

  if (!enviar) {
    console.log(`No se envió correo (agregue --enviar). Destino sería: ${correoArg || evento.documento.correo}`);
    return;
  }
  const tipo = String(evento.documento.tipoDte);
  const pdfDte = path.join(__dirname, `../storage/pdf/${esquema}/dte${tipo}/${ano}/${numeroControlDte}.pdf`);
  const r = await emailInvalidado({
    numeroControlDte,
    email: correoArg || evento.documento.correo,
    nombreCliente: evento.documento.nombre,
    empresa,
    jsonEvento: json,
    pdfEvento: pdf,
    pdfDte,
  });
  console.log(r.ok ? `Correo enviado a ${correoArg || evento.documento.correo}` : `No se pudo enviar: ${r.error}`);
};

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 500));
