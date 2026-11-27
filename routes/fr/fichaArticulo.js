const express = require("express");

const {
  getFichasArticulo,
  postFichaArticulo,
  getFichaArticuloPdf,
  deleteFichaArticulo,
} = require("../../controllers/fr/fichaArticulo");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");
const subirPdf = require("../../middleware/subirPdf");

const sesion = [authMiddleware, checkRol(["Admin", "Fr"])];

router.get("/", ...sesion, getFichasArticulo);
router.get("/:articulo/pdf", ...sesion, getFichaArticuloPdf);
router.post("/:articulo", ...sesion, subirPdf("archivo"), postFichaArticulo);
router.delete("/:articulo", ...sesion, deleteFichaArticulo);

module.exports = router;
