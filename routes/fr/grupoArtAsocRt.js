const express = require("express");

const {
  getGrupoArtAsocRt,
  postGrupoArtAsocRt,
  deleteGrupoArtAsocRt,
} = require("../../controllers/fr/grupoArtAsocRt");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getGrupoArtAsocRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postGrupoArtAsocRt);
router.delete("/:grupoArticulo/:articulo", authMiddleware, checkRol(["Admin", "Fr"]), deleteGrupoArtAsocRt);

module.exports = router;
