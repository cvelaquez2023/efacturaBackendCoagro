const express = require("express");

const {
  getGrupoArtAsocRt,
  postGrupoArtAsocRt,
  deleteGrupoArtAsocRt,
} = require("../../controllers/fr/grupoArtAsocRt");

const router = express.Router();

router.get("/", getGrupoArtAsocRt);
router.post("/", postGrupoArtAsocRt);
router.delete("/:grupoArticulo/:articulo", deleteGrupoArtAsocRt);

module.exports = router;
