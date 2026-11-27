const multer = require("multer");

const MAX_MB = 10;

// PDF en memoria (el controlador decide donde guardarlo), solo .pdf, max 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.pdf$/i.test(file.originalname)) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
});

/**
 * Middleware que recibe un PDF en el campo indicado y responde con el
 * formato estandar { result, success, errors } si algo falla.
 * Ademas de la extension revisa que el contenido empiece con %PDF.
 */
const subirPdf = (campo = "archivo") => (req, res, next) => {
  upload.single(campo)(req, res, (err) => {
    let msg = null;
    if (err) {
      msg = "No se pudo recibir el archivo.";
      if (err.code === "LIMIT_FILE_SIZE") msg = `El archivo supera el maximo de ${MAX_MB} MB.`;
      else if (err.code === "LIMIT_UNEXPECTED_FILE")
        msg = `Solo se acepta un archivo PDF en el campo '${campo}'.`;
    } else if (!req.file) {
      msg = `Debe enviar el PDF en el campo '${campo}'.`;
    } else if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      msg = "El archivo no es un PDF valido.";
    }
    if (msg) return res.send({ result: {}, success: false, errors: [msg] });
    next();
  });
};

module.exports = subirPdf;
