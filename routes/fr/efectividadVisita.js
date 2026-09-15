const express = require("express");

const {
  getEfectividadVisitas,
  getEfectividadVisita,
  postEfectividadVisita,
  putEfectividadVisita,
  deleteEfectividadVisita,
} = require("../../controllers/fr/efectividadVisita");

const router = express.Router();

router.get("/", getEfectividadVisitas);
router.get("/:efectVisita", getEfectividadVisita);
router.post("/", postEfectividadVisita);
router.put("/:efectVisita", putEfectividadVisita);
router.delete("/:efectVisita", deleteEfectividadVisita);

module.exports = router;
