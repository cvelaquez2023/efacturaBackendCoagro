const express = require("express");

const {
  getArticulosErp,
  getArticuloErp,
} = require("../../controllers/fr/articuloErp");

const router = express.Router();

router.get("/", getArticulosErp);
router.get("/:articulo", getArticuloErp);

module.exports = router;
