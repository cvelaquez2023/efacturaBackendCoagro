const express = require("express");

const {
  getGruposArticuloRt,
  getGrupoArticuloRt,
  postGrupoArticuloRt,
  putGrupoArticuloRt,
  deleteGrupoArticuloRt,
} = require("../../controllers/fr/grupoArticuloRt");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getGruposArticuloRt);
router.get("/:grupoArticulo", authMiddleware, checkRol(["Admin", "Fr"]), getGrupoArticuloRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postGrupoArticuloRt);
router.put("/:grupoArticulo", authMiddleware, checkRol(["Admin", "Fr"]), putGrupoArticuloRt);
router.delete("/:grupoArticulo", authMiddleware, checkRol(["Admin", "Fr"]), deleteGrupoArticuloRt);

module.exports = router;
