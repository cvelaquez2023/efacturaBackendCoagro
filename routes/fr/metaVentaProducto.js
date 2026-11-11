const express = require("express");

const {
  getMetasVentaProducto,
  getMetaVentaProducto,
  postMetaVentaProducto,
  putMetaVentaProducto,
  deleteMetaVentaProducto,
} = require("../../controllers/fr/metaVentaProducto");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getMetasVentaProducto);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getMetaVentaProducto);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postMetaVentaProducto);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putMetaVentaProducto);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deleteMetaVentaProducto);

module.exports = router;
