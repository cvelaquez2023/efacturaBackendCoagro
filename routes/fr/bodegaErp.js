const express = require("express");

const {
  getBodegasErp,
  getBodegaErp,
} = require("../../controllers/fr/bodegaErp");

const router = express.Router();

router.get("/", getBodegasErp);
router.get("/:bodega", getBodegaErp);

module.exports = router;
