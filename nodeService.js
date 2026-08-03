const Service = require("node-windows").Service;
const path = process.env.PATH;
const svc = new Service({
  name: "ApiTiendaLinea",
  description: "Tienda en Linea de Bellmart",
  script: "C:\\Dev\\bellmart\\ApiJs\\app.js",
});
svc.on("install", function () {
  svc.start();
});

svc.install();
