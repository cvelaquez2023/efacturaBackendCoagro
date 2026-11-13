const express = require("express");
const crud = require("../../controllers/fr/descuentoCliart");

// Auth (token + rol Admin) lo aplica routes/fr/index.js para todo /fr.
const router = express.Router();

router.get("/", crud.listar);
router.get(crud.llavePath, crud.obtener);
router.post("/", crud.crear);
router.put(crud.llavePath, crud.actualizar);
router.delete(crud.llavePath, crud.eliminar);

module.exports = router;
