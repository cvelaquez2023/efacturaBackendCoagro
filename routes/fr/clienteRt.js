const express = require("express");

const {
  getClientesRt,
  getClienteRt,
  postClienteRt,
  putClienteRt,
  deleteClienteRt,
} = require("../../controllers/fr/clienteRt");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getClientesRt);
router.get("/:cliente", authMiddleware, checkRol(["Admin", "Fr"]), getClienteRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postClienteRt);
router.put("/:cliente", authMiddleware, checkRol(["Admin", "Fr"]), putClienteRt);
router.delete("/:cliente", authMiddleware, checkRol(["Admin", "Fr"]), deleteClienteRt);

module.exports = router;
