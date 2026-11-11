const express = require("express");

const {
  getProveedoresMeta,
  getProveedorMeta,
  postProveedorMeta,
  putProveedorMeta,
  deleteProveedorMeta,
} = require("../../controllers/fr/proveedorMeta");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getProveedoresMeta);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getProveedorMeta);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postProveedorMeta);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putProveedorMeta);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deleteProveedorMeta);

module.exports = router;
