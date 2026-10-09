const express = require("express");

const {
  getClientesAsocRt,
  getClienteAsocRt,
  postClienteAsocRt,
  putClienteAsocRt,
  deleteClienteAsocRt,
} = require("../../controllers/fr/clienteAsocRt");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getClientesAsocRt);
router.get("/:codigo", authMiddleware, checkRol(["Admin", "Fr"]), getClienteAsocRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postClienteAsocRt);
router.put("/:codigo", authMiddleware, checkRol(["Admin", "Fr"]), putClienteAsocRt);
router.delete("/:codigo", authMiddleware, checkRol(["Admin", "Fr"]), deleteClienteAsocRt);

module.exports = router;
