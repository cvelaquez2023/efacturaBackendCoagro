const multer = require("multer");

const MAX_MB = 10;

// Excel en memoria (no se guarda en disco), solo .xlsx, max 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
});

/**
 * Middleware que recibe un Excel en el campo indicado y responde con el
 * formato estandar { result, success, errors } si algo falla.
 */
const subirExcel = (campo = "archivo") => (req, res, next) => {
  upload.single(campo)(req, res, (err) => {
    if (!err) return next();
    let msg = "No se pudo recibir el archivo.";
    if (err.code === "LIMIT_FILE_SIZE") msg = `El archivo supera el maximo de ${MAX_MB} MB.`;
    else if (err.code === "LIMIT_UNEXPECTED_FILE")
      msg = `Solo se acepta un archivo Excel .xlsx en el campo '${campo}'.`;
    res.send({ result: {}, success: false, errors: [msg] });
  });
};

module.exports = subirExcel;
