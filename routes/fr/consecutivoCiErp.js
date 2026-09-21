const express = require("express");

const {
  getConsecutivosCiErp,
  getConsecutivoCiErp,
} = require("../../controllers/fr/consecutivoCiErp");

const router = express.Router();

router.get("/", getConsecutivosCiErp);
router.get("/:consecutivo", getConsecutivoCiErp);

module.exports = router;
