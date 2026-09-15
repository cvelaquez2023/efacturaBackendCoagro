const cron = require("node-cron");
const { sequelize } = require("../config/mssql");
const { QueryTypes } = require("sequelize");
const logger = require("../utils/logger");
const { notifyError } = require("../utils/errorNotifier");

let isRunning = false;

const enviarDtesPendientes = async () => {
  if (isRunning) {
    logger.info("Cron envioDte anterior aun ejecutandose, saltando...", { controller: "cron", action: "envioDte" });
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const host = process.env.HOST || "localhost";
    const port = process.env.PORT || 5000;
    const baseUrl = `http://${host}:${port}`;

    const dtes = await sequelize.query(
      `SELECT DATEDIFF(MINUTE,recordDate,GETDATE()) AS MINUTOS, factura, empresa 
       FROM dte.dbo.facturaDte 
       WHERE procesadoMH=0 AND rechazadoMH=0 AND contingenciaMH=0 
       AND factura LIKE 'DTE-%'
       AND factura NOT LIKE 'DTE-14-%'`,
      { type: QueryTypes.SELECT }
    );

    if (!dtes || dtes.length === 0) {
      logger.info("No hay DTEs pendientes para enviar", { controller: "cron", action: "envioDte" });
      return;
    }

    logger.info(`Encontrados ${dtes.length} DTEs pendientes`, { controller: "cron", action: "envioDte" });

    let enviados = 0;
    let errores = 0;
    let saltados = 0;

    for (const dte of dtes) {
      try {
        const factura = dte.factura;
        const empresa = dte.empresa;
        const tipo = factura.substring(4, 6);
        const minutos = parseInt(dte.MINUTOS) || 0;

        if (minutos < 1) {
          saltados++;
          continue;
        }

        const url = `${baseUrl}/api/v1/envioMH/dte${tipo}/${factura}/${empresa}`;
        logger.info(`Enviando DTE: ${factura} (tipo ${tipo}, empresa ${empresa}, minutos: ${minutos})`, { controller: "cron", action: "envioDte" });

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          errores++;
          logger.warn(`DTE ${factura} respondio HTML, no JSON (falta auth?) - status: ${response.status}`, { controller: "cron", action: "envioDte" });
          continue;
        }

        const result = await response.json();

        if (response.ok && result.success !== false) {
          enviados++;
          logger.info(`DTE enviado exitosamente: ${factura}`, { controller: "cron", action: "envioDte" });
        } else {
          errores++;
          logger.warn(`DTE con respuesta no exitosa: ${factura} - ${JSON.stringify(result)}`, { controller: "cron", action: "envioDte" });
        }
      } catch (err) {
        errores++;
        logger.error(`Error enviando DTE ${dte.factura}: ${err.message}`, { controller: "cron", action: "envioDte", stack: err.stack });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Cron envioDte completado en ${elapsed}s - Enviados: ${enviados}, Errores: ${errores}, Saltados: ${saltados}`, { controller: "cron", action: "envioDte" });

  } catch (error) {
    logger.error(`Error general en cron envioDte: ${error.message}`, { controller: "cron", action: "envioDte", stack: error.stack });
    await notifyError("cron", "envioDte", error);
  } finally {
    isRunning = false;
  }
};

const startCron = () => {
  cron.schedule("* * * * *", enviarDtesPendientes);
  logger.info("Cron envioDte iniciado - cada 1 minuto", { controller: "cron", action: "startCron" });
};

module.exports = { startCron, enviarDtesPendientes };
