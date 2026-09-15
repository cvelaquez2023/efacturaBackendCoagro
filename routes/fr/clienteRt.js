const express = require("express");

const {
  getClientesRt,
  getClienteRt,
  postClienteRt,
  putClienteRt,
  deleteClienteRt,
} = require("../../controllers/fr/clienteRt");

const router = express.Router();

router.get("/", getClientesRt);
router.get("/:cliente", getClienteRt);
router.post("/", postClienteRt);
router.put("/:cliente", putClienteRt);
router.delete("/:cliente", deleteClienteRt);

module.exports = router;
