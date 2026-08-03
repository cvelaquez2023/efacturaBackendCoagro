require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const { dbConnect } = require("./config/mssql");
const bodyParser = require("body-parser");
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;
/**
 * Aqui invocamos a las rutas
 */
//
app.use("/api/v1", require("./routes"));
/** 

https
  .createServer(
    {
      cert: fs.readFileSync("2c9fa8ab1a2a450f.crt"),
      key: fs.readFileSync("generated-private-key-bellmart-api2.key"),
      ca: fs.readFileSync("gd_bundle-g2-g1.crt"),
    },
    app
  )
  */
app.listen(port, () => {
  console.log("tu app esta lista por http://localhost:" + port);
});

dbConnect();
