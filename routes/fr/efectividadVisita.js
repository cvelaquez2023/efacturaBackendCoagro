const express = require("express");

const {
  getEfectividadVisitas,
  getEfectividadVisita,
  postEfectividadVisita,
  putEfectividadVisita,
  deleteEfectividadVisita,
} = require("../../controllers/fr/efectividadVisita");

const router = express.Router();

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getEfectividadVisitas);
router.get("/:efectVisita", authMiddleware, checkRol(["Admin", "Fr"]), getEfectividadVisita);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postEfectividadVisita);
router.put("/:efectVisita", authMiddleware, checkRol(["Admin", "Fr"]), putEfectividadVisita);
router.delete("/:efectVisita", authMiddleware, checkRol(["Admin", "Fr"]), deleteEfectividadVisita);

module.exports = router;
