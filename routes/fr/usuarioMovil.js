// Administracion de usuarios de la app movil (rol RUTA). Solo Admin (ver routes/fr/index.js).

const { Router } = require("express");
const {
  getUsuariosMovil,
  putAprobarUsuarioMovil,
  putActivoUsuarioMovil,
  deleteUsuarioMovil,
} = require("../../controllers/fr/mobile");

const router = Router();

router.get("/", getUsuariosMovil);
router.put("/:id/aprobar", putAprobarUsuarioMovil);
router.put("/:id/activo", putActivoUsuarioMovil);
router.delete("/:id", deleteUsuarioMovil);

module.exports = router;
