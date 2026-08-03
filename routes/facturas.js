const express = require("express");
const router = express.Router();
const { getPedido, getFactura } = require("../controllers/pedido");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

router.post("/:fac", getFactura);
router.put("/:factura", authMiddleware, checkRol(["User", "Admin"]), getPedido);

module.exports = router;
