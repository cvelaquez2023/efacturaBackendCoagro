const { toString } = require("qrcode");
const { readFileSync, writeFileSync } = require("fs");
const { write } = require("pdfkit");

const Print = (msg) => console.log(msg);

const rqcode = async (datos, tipo) => {
  if (tipo === "07") {
    const http = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datos.ambiente}&codGen=${datos.codGen}&fechaEmi=${datos.fechaEmi}`;
    toString(
      http,
      {
        type: "svg",
      },
      (err, data) => {
        if (err) return Print(`Ocurrio un error ${err}`);
        var web = readFileSync(__dirname + "/dte07/index07.html", {
          encoding: "utf8",
        }).replace("[QR CODE]", data);
        writeFileSync(__dirname + "/dte07/index.html", web, {
          encoding: "utf-8",
        });
      }
    );
  }
  if (tipo === "14") {
    const http = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datos.ambiente}&codGen=${datos.codGen}&fechaEmi=${datos.fechaEmi}`;
    toString(
      http,
      {
        type: "svg",
      },
      (err, data) => {
        if (err) return Print(`Ocurrio un error ${err}`);
        var web = readFileSync(__dirname + "/dte14/index14.html", {
          encoding: "utf8",
        }).replace("[QR CODE]", data);
        writeFileSync(__dirname + "/dte14/index.html", web, {
          encoding: "utf-8",
        });
      }
    );
  }
  if (tipo === "05") {
    const http = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datos.ambiente}&codGen=${datos.codGen}&fechaEmi=${datos.fechaEmi}`;

    toString(
      http,
      {
        type: "svg",
      },
      (err, data) => {
        if (err) return Print(`Ocurrio un error ${err}`);
        var web = readFileSync(__dirname + "/dte05/index05.html", {
          encoding: "utf8",
        }).replace("[QR CODE]", data);
        writeFileSync(__dirname + "/dte05/index.html", web, { encoding: "utf-8" });
      }
    );
  } else {
    const http = `https://admin.factura.gob.sv/consultaPublica?ambiente=${datos.ambiente}&codGen=${datos.codGen}&fechaEmi=${datos.fechaEmi}`;
    toString(
      http,
      {
        type: "svg",
      },
      (err, data) => {
        if (err) return Print(`Ocurrio un error ${err}`);
        var web = readFileSync(__dirname + "/ccf.html", {
          encoding: "utf8",
        }).replace("[QR CODE]", data);
        writeFileSync(__dirname + "/index.html", web, { encoding: "utf-8" });
      }
    );
  }
};

module.exports = rqcode;
