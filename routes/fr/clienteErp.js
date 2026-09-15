const express = require("express");

const {
  getClientesErp,
  getClienteErp,
} = require("../../controllers/fr/clienteErp");

const router = express.Router();

router.get("/", getClientesErp);
router.get("/:cliente", getClienteErp);

module.exports = router;
