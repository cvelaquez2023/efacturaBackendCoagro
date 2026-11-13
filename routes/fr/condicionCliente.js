const express = require("express");

const {
  getCondicionesCliente,
  getCondicionCliente,
  postCondicionCliente,
  putCondicionCliente,
  deleteCondicionCliente,
} = require("../../controllers/fr/condicionCliente");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getCondicionesCliente);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getCondicionCliente);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postCondicionCliente);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putCondicionCliente);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deleteCondicionCliente);

module.exports = router;
