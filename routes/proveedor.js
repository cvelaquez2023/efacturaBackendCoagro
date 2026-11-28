const express = require("express");
const { getProveedorSoftland, buscarProveedoresSoftland } = require("../controllers/Dtes/proveedor");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

const router = express.Router();

// Búsqueda por código, nombre, alias o contribuyente: GET /proveedor?q=texto
router.get("/", authMiddleware, checkRol(["User", "Admin"]), buscarProveedoresSoftland);

router.get("/:id", authMiddleware,
  checkRol(["User", "Admin"]),  getProveedorSoftland);


module.exports = router;