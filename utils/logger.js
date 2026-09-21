const winston = require("winston");
const path = require("path");

const logsDir = path.join(__dirname, "..", "logs");

const logger = winston.createLogger({
  level: "info",
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, controller, action }) => {
      let msg = `[${timestamp}] [${level.toUpperCase()}]`;
      if (controller) msg += ` [${controller}]`;
      if (action) msg += ` [${action}]`;
      msg += ` ${message}`;
      if (stack) msg += `\n${stack}`;
      return msg;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, controller, action }) => {
          let msg = `[${timestamp}] ${level}`;
          if (controller) msg += ` [${controller}]`;
          if (action) msg += ` [${action}]`;
          msg += `: ${message}`;
          return msg;
        })
      ),
    })
  );
}

module.exports = logger;
