const express = require("express");

const { cargaAlErp, cargaAlMovil } = require("../../controllers/fr/carga");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.post("/erp", authMiddleware, checkRol(["Admin", "Fr"]), cargaAlErp);
router.post("/movil", authMiddleware, checkRol(["Admin", "Fr"]), cargaAlMovil);

module.exports = router;
