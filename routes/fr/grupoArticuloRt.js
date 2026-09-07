const express = require("express");

const {
  getGruposArticuloRt,
  getGrupoArticuloRt,
  postGrupoArticuloRt,
  putGrupoArticuloRt,
  deleteGrupoArticuloRt,
} = require("../../controllers/fr/grupoArticuloRt");

const router = express.Router();

router.get("/", getGruposArticuloRt);
router.get("/:grupoArticulo", getGrupoArticuloRt);
router.post("/", postGrupoArticuloRt);
router.put("/:grupoArticulo", putGrupoArticuloRt);
router.delete("/:grupoArticulo", deleteGrupoArticuloRt);

module.exports = router;
