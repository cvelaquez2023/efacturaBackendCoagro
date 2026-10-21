const express = require("express");

const {
  getBodegasErp,
  getBodegaErp,
} = require("../../controllers/fr/bodegaErp");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getBodegasErp);
router.get("/:bodega", authMiddleware, checkRol(["Admin", "Fr"]), getBodegaErp);

module.exports = router;
