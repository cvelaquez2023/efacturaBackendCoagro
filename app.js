require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const { dbConnect } = require("./config/mssql");
const bodyParser = require("body-parser");
const { startCron } = require("./cron/envioDte");
const app = express();
app.use(cors());
// La handheld sube en un solo request todo lo registrado sin conexion: sin limite de tamano.
// Va antes del parser global (100kb) para que ese no lo rechace.
app.use("/api/v1/fr/sync/enviar", bodyParser.json({ limit: Infinity }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;

app.use("/api/v1", require("./routes"));

app.listen(port, () => {
  console.log("tu app esta lista por http://localhost:" + port);
  startCron();
});

dbConnect();
