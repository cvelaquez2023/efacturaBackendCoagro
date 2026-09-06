const express = require("express");

const {
  getVendedoresErp,
  getVendedorErp,
} = require("../../controllers/fr/vendedorErp");

const router = express.Router();

router.get("/", getVendedoresErp);
router.get("/:vendedor", getVendedorErp);

module.exports = router;
