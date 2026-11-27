//
// Ficha tecnica de articulos: un PDF por articulo, guardado en el servidor (sin tabla en la BD).
//
//   <backend>/storage/pdf/CINCOH/ficha_articulo/<ARTICULO>.pdf
//
// Que exista el archivo = el articulo tiene ficha. Subir otra vez reemplaza la anterior.
// La fecha y el tamano salen del propio archivo.
//
// Web (sesion normal, rol Admin o Fr):
//   GET    /fr/fichaArticulo?q=texto&page=1&limit=20  -> articulos con ficha
//   POST   /fr/fichaArticulo/:articulo                -> sube o reemplaza (multipart, campo "archivo")
//   GET    /fr/fichaArticulo/:articulo/pdf            -> ver (inline) o ?descargar=1
//   DELETE /fr/fichaArticulo/:articulo                -> borra la ficha
//
// App movil (token movil, rol RUTA):
//   GET    /fr/mobile/fichaArticulo                   -> lista de codigos con ficha (sin paginar)
//   GET    /fr/mobile/fichaArticulo/:articulo/pdf     -> el PDF
//
// El nombre del archivo es el codigo del articulo tal como esta en erpadmin.ARTICULO, codificado
// con encodeURIComponent (+ '*') para que un codigo con '/', '\' u otros caracteres no salga de la
// carpeta ni rompa el nombre en Windows. Los codigos normales (letras, numeros, '-', '.') quedan igual.

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { articuloErpModel } = require("../../models");
const { getPaginacion } = require("../../utils/paginacion");

const CARPETA = path.join(__dirname, "../..", "storage", "pdf", "CINCOH", "ficha_articulo");

const error = (res, mensaje) => res.send({ result: {}, success: false, errors: [mensaje] });

const aArchivo = (articulo) =>
  encodeURIComponent(articulo).replace(/\*/g, "%2A") + ".pdf";

const deArchivo = (nombre) => {
  try {
    return decodeURIComponent(nombre.replace(/\.pdf$/i, ""));
  } catch {
    return null;
  }
};

const rutaFicha = (articulo) => path.join(CARPETA, aArchivo(articulo));

// Codigo tal como esta en el ERP (la BD no distingue mayusculas; el disco en Linux si).
const buscarArticulo = (articulo) =>
  articuloErpModel.findOne({
    attributes: ["ARTICULO", "DESCRIPCION"],
    where: { ARTICULO: articulo },
    raw: true,
  });

// Codigo del parametro: el del ERP si existe; si ya no existe, el que mandaron (para poder ver/borrar).
const codigoParam = async (req) => {
  const articulo = String(req.params.articulo || "").trim();
  if (!articulo) return null;
  const erp = await buscarArticulo(articulo);
  return erp ? erp.ARTICULO : articulo;
};

// Fichas en disco: [{ articulo, tamano, fecha }]
const leerFichas = () => {
  if (!fs.existsSync(CARPETA)) return [];
  return fs
    .readdirSync(CARPETA, { withFileTypes: true })
    .filter((f) => f.isFile() && /\.pdf$/i.test(f.name))
    .map((f) => {
      const articulo = deArchivo(f.name);
      if (!articulo) return null;
      const stat = fs.statSync(path.join(CARPETA, f.name));
      return { articulo, tamano: stat.size, fecha: stat.mtime };
    })
    .filter(Boolean);
};

const enviarPdf = (res, archivo, articulo, descargar) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${descargar ? "attachment" : "inline"}; filename="ficha_${String(articulo).replace(/[^\w.-]/g, "_")}.pdf"`
  );
  res.sendFile(archivo);
};

// GET /fr/fichaArticulo?q=texto&page=1&limit=20
const getFichasArticulo = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const fichas = leerFichas();

    const descripciones = {};
    if (fichas.length) {
      const codigos = fichas.map((f) => f.articulo);
      // SQL Server admite ~2100 parametros por consulta: se busca por bloques.
      for (let i = 0; i < codigos.length; i += 1000) {
        const filas = await articuloErpModel.findAll({
          attributes: ["ARTICULO", "DESCRIPCION"],
          where: { ARTICULO: { [Op.in]: codigos.slice(i, i + 1000) } },
          raw: true,
        });
        filas.forEach((a) => (descripciones[a.ARTICULO.toUpperCase()] = a.DESCRIPCION));
      }
    }

    const q = String(req.query.q || "").trim().toUpperCase();
    const filas = fichas
      .map((f) => ({
        ARTICULO: f.articulo,
        DESCRIPCION: descripciones[f.articulo.toUpperCase()] || null,
        TAMANO: f.tamano,
        FECHA: f.fecha,
      }))
      .filter(
        (f) =>
          !q ||
          f.ARTICULO.toUpperCase().includes(q) ||
          (f.DESCRIPCION || "").toUpperCase().includes(q)
      )
      .sort((a, b) => a.ARTICULO.localeCompare(b.ARTICULO));

    res.send({
      result: filas.slice(offset, offset + limit),
      success: true,
      pagination: {
        page,
        limit,
        total: filas.length,
        totalPages: Math.max(Math.ceil(filas.length / limit), 1),
      },
    });
  } catch (err) {
    console.log(err);
    error(res, "Error al consultar las fichas tecnicas");
  }
};

// POST /fr/fichaArticulo/:articulo   (multipart, campo "archivo"; ya validado por subirPdf)
const postFichaArticulo = async (req, res) => {
  try {
    const param = String(req.params.articulo || "").trim();
    const erp = param ? await buscarArticulo(param) : null;
    if (!erp) return error(res, `No existe el articulo ${param}`);

    fs.mkdirSync(CARPETA, { recursive: true });
    const archivo = rutaFicha(erp.ARTICULO);
    const reemplazo = fs.existsSync(archivo);

    // Se escribe en un temporal y se renombra: si falla a medias no queda un PDF roto.
    const temporal = `${archivo}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporal, req.file.buffer);
    try {
      fs.renameSync(temporal, archivo);
    } catch (e) {
      fs.rmSync(temporal, { force: true });
      throw e;
    }

    res.send({
      result: {
        ARTICULO: erp.ARTICULO,
        DESCRIPCION: erp.DESCRIPCION,
        TAMANO: req.file.size,
        reemplazo,
      },
      success: true,
    });
  } catch (err) {
    console.log(err);
    error(res, "Error al guardar la ficha tecnica");
  }
};

// GET /fr/fichaArticulo/:articulo/pdf[?descargar=1]   y   GET /fr/mobile/fichaArticulo/:articulo/pdf
const getFichaArticuloPdf = async (req, res) => {
  try {
    const articulo = await codigoParam(req);
    if (!articulo) return error(res, "Debe indicar el articulo");
    const archivo = rutaFicha(articulo);
    if (!fs.existsSync(archivo)) return error(res, `El articulo ${articulo} no tiene ficha tecnica`);
    enviarPdf(res, archivo, articulo, req.query.descargar === "1");
  } catch (err) {
    console.log(err);
    if (!res.headersSent) error(res, "Error al obtener la ficha tecnica");
  }
};

// DELETE /fr/fichaArticulo/:articulo
const deleteFichaArticulo = async (req, res) => {
  try {
    const articulo = await codigoParam(req);
    if (!articulo) return error(res, "Debe indicar el articulo");
    const archivo = rutaFicha(articulo);
    if (!fs.existsSync(archivo)) return error(res, `El articulo ${articulo} no tiene ficha tecnica`);
    fs.unlinkSync(archivo);
    res.send({ result: { ARTICULO: articulo }, success: true });
  } catch (err) {
    console.log(err);
    error(res, "Error al borrar la ficha tecnica");
  }
};

// GET /fr/mobile/fichaArticulo  -> la app marca que articulos tienen ficha
const getFichasArticuloMovil = (req, res) => {
  try {
    const result = leerFichas()
      .map((f) => ({ ARTICULO: f.articulo, FECHA: f.fecha }))
      .sort((a, b) => a.ARTICULO.localeCompare(b.ARTICULO));
    res.send({ result, success: true });
  } catch (err) {
    console.log(err);
    error(res, "Error al consultar las fichas tecnicas");
  }
};

module.exports = {
  getFichasArticulo,
  postFichaArticulo,
  getFichaArticuloPdf,
  deleteFichaArticulo,
  getFichasArticuloMovil,
};
