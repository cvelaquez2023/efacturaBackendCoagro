const nodemailer = require("nodemailer");

const EMAIL = process.env.EMAIL;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
//console.log(EMAIL);


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    // TODO: replace `user` and `pass` values from <https://forwardemail.net>
    user: EMAIL,
    pass: EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});


/*
const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  secure: true,
  secureConnection: false, // TLS requires secureConnection to be false
  tls: {
    ciphers: "SSLv3",
  },
  requireTLS: true,
  port: 465,
  debug: false,
  auth: {
    // TODO: replace `user` and `pass` values from <https://forwardemail.net>
    user: EMAIL,
    pass: EMAIL_PASSWORD,
  },
});
*/
transporter.verify().then(() => {
  console.log("Listo el Servidor de Correos");
});

module.exports = { transporter };
