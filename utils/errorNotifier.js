const logger = require("./logger");
const { transporter } = require("../config/mailer");

const EMPRESA_NOMBRE = process.env.DTE_NOMBRE || "COAGRO, S.A. DE C.V.";
const ERROR_EMAIL = process.env.ERROR_NOTIFICATION_EMAIL;

let lastEmailTime = 0;
const EMAIL_THROTTLE_MS = 60000;

const notifyError = async (controller, action, error, extraInfo = "") => {
  const timestamp = new Date().toISOString();
  const errorMsg = error?.message || String(error);
  const errorStack = error?.stack || "";

  logger.error(`${action}: ${errorMsg}`, {
    controller,
    action,
    stack: errorStack,
  });

  if (!ERROR_EMAIL) return;

  const now = Date.now();
  if (now - lastEmailTime < EMAIL_THROTTLE_MS) return;

  try {
    lastEmailTime = now;
    await transporter.sendMail({
      from: `"Soporte ${EMPRESA_NOMBRE}" <${process.env.EMAIL}>`,
      to: ERROR_EMAIL,
      subject: `[${EMPRESA_NOMBRE}] ERROR en ${controller} - ${action}`,
      html: `
        <h2 style="color: #d32f2f;">Alerta de Error - ${EMPRESA_NOMBRE}</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Empresa:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${EMPRESA_NOMBRE}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Controller:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${controller}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Acci&oacute;n:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${action}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Fecha:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${timestamp}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Nivel:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">ERROR</td></tr>
        </table>
        <h3 style="color: #d32f2f; margin-top: 20px;">Mensaje de Error:</h3>
        <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px;">${errorMsg}</pre>
        ${errorStack ? `<h3>Stack Trace:</h3><pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${errorStack}</pre>` : ""}
        ${extraInfo ? `<h3>Informaci&oacute;n Adicional:</h3><pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px;">${extraInfo}</pre>` : ""}
        <hr style="margin-top: 20px;">
        <p style="color: #666; font-size: 12px;">Este es un correo autom&aacute;tico generado por el sistema de monitoreo de ${EMPRESA_NOMBRE}.</p>
      `,
    });
  } catch (emailErr) {
    logger.error(`Error al enviar correo de notificacion: ${emailErr.message}`, {
      controller: "errorNotifier",
      action: "sendNotificationEmail",
    });
  }
};

const notifyWarn = async (controller, action, message, extraInfo = "") => {
  logger.warn(`${action}: ${message}`, { controller, action });
};

module.exports = { notifyError, notifyWarn };
