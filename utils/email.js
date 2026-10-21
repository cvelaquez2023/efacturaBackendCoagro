const { transporter } = require("../config/mailer");
const fs = require("fs");
const path = require("path");
const { Sqlempresa } = require("../sqltx/sql");
const logger = require("./logger");

const emailRechazo = async (dte, email, tipo, ano,esquema) => {
  const data = fs.readFileSync(
    `"../../storage/json/${esquema}/${tipo}/rechazados/${ano}/${dte}.json`,
    "utf8"
  );
  /*
  const dataPDF = fs.readFileSync(
    `"../../storage/pdf/dte01/${dte}.pdf`,
    "utf8"
  );
  */

  try {
    return await transporter.sendMail({
      from: '"Soporte Coagro S.A.de C.V." <coagrodte@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Rechazo de Dte ", // Subject line
      attachments: [
        {
          filename: `${dte}.json`,
          content: data,
        },
        /*
        {
          filename: `${dte}.pdf`,
          content: dataPDF,
        },
        */
      ],
      html: `
             Hola,
             <br>
             <br>
             El Ministerio de Hacienda  a Rechazado el siguiente Documento Tributario Eletronico ${dte}  
             <br>
             <br>
             <span>H2C S.A. de C.V.</span> Soporte
            `, // html body
    });
  } catch (error) {
    console.log(error);
  }
};
// Envía el JSON y PDF del DTE al cliente. No lanza errores: devuelve { ok, error }
// para que la emisión ya aceptada por MH no se interrumpa si falla el correo.
const emailEnviado = async (dte, email,emailv,nombreCliente, tipo,ano,empresa_id) => {
  const logCtx = { controller: "email", action: "emailEnviado" };
  try {
    const empresa=await Sqlempresa(empresa_id)
    const esquema = empresa[0].esquemaBD;
    // Mismas rutas donde los controladores guardan el JSON y generaPdf el PDF.
    const jsonPath = path.join(__dirname, `../storage/json/${esquema}/${tipo}/aceptados/${ano}/${dte}.json`);
    const pdfPath = path.join(__dirname, `../storage/pdf/${esquema}/${tipo}/${ano}/${dte}.pdf`);
    const data = fs.readFileSync(jsonPath, "utf8");
    const _nombre =empresa[0].nombre;
    const info = await transporter.sendMail({
      from: { name: `Soporte ${_nombre}`, address: empresa[0].correoDte }, // sender address
      to: email, // list of receivers
      cc:emailv,
      subject: "Envio de Dte ", // Subject line
      attachments: [
        {
          filename: `${dte}.json`,
          content: data,
        },

        {
          filename: `${dte}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
      html: `
                   Estimado Cliente :'${nombreCliente}' , por este medio hacemos llegar su Comprobante de Documento Tributario Eletronico,
                   <br>
                   <br>
                   Agradecemos su preferencia a nuestros productos y servicios
                   <br>
                   <br>
                   <span>${_nombre}</span> Soporte
                  `, // html body
    });
    logger.info(
      `Correo enviado ${dte} a ${email} (cc ${emailv}) id ${info.messageId}` +
        (info.rejected && info.rejected.length ? ` rechazados: ${info.rejected.join(", ")}` : ""),
      logCtx
    );
    return { ok: true };
  } catch (error) {
    logger.error(`Error enviando correo ${dte} a ${email}: ${error.message}`, logCtx);
    return { ok: false, error: error.message };
  }
};

const emailInvalidado = async (dte, email, tipo,ano,empresa) => {
  try {
    setTimeout(function () {
      const data = fs.readFileSync(
        `"../../storage/json/${empresa[0].esquemaBD}/${tipo}/aceptados/${ano}/${dte}.json`,
        "utf8"
      );
      const dataPDF = fs.readFileSync(
        `"../../storage/pdf/${empresa[0].esquemaBD}/${tipo}/${ano}/${dte}.pdf`,
        "utf-8"
      );
      return transporter.sendMail({
        from: '"Soporte Coagro S.A.de C.V." <coagrodte@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Envio de Dte ", // Subject line
        attachments: [
          {
            filename: `${dte}.json`,
            content: data,
          },

          {
            filename: `${dte}.pdf`,
            path: `"../../storage/pdf/${empresa[0].esquemaBD}/${tipo}/${ano}/${dte}.pdf`,
            contentType: "application/pdf",
          },
        ],
        html: `
                     Estimado Cliente , por este medio hacemos de su Conocimineto que se invalido  su Comprobante de Documento Tributario Eletronico,
                     <br>
                     <br>
                     Agradecemos su preferencia a nuestros productos y servicios   
                     <br>
                     <br>
                     <span>Coagro S.A. de C.V.</span> Soporte
                    `, // html body
      });
    }, 15000);
  } catch (error) {
    console.log(error);
  }
};

const emailContingencia = async (dte, email, tipo,ano) => {
  const data = fs.readFileSync(
    `"../../storage/json/${tipo}/contingencia/${ano}/${dte}.json`,
    "utf8"
  );
  // const dataPDF = fs.readFileSync(`../../storage/pdf/dte01/${dte}.pdf`);

  try {
    return await transporter.sendMail({
      from: '"Soporte Coagro S.A.de C.V." <coagrodte@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Envio de Dte ", // Subject line
      attachments: [
        {
          filename: `${dte}.json`,
          content: data,
        },

        /*    
        {
          filename: `${dte}.pdf`,
          content: dataPDF,
          contentType: "application/pdf",
        },
        */
      ],
      html: `
                   Estimado Cliente , por este medio hacemos llegar su Comprobante de Documento Tributario Eletronico,
                   <br>
                   <br>
                   Agradecemos su preferencia a nuestros productos y servicios   
                   <br>
                   <br>
                   <span>Coagro S.A. de C.V.</span> Soporte
                  `, // html body
    });
  } catch (error) {
    console.log(error);
  }
};

const emailError = async (email, error) => {
  try {
    return await transporter.sendMail({
      from: '"Soporte Coagro S.A.de C.V." <coagrodte@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Envio de Dte ", // Subject line

      html: `
                   Estimado Cliente , Existe un error,
                   <br>
                   <br>
                   Error en el servicio de ${error}
                   <br>
                   <br>
                   <span>Coagro S.A. de C.V.</span> Soporte
                  `, // html body
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  emailRechazo,
  emailEnviado,
  emailError,
  emailContingencia,
  emailInvalidado,
};
