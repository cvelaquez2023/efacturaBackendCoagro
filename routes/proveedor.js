const express = require("express");
const { getProveedorSoftland } = require("../controllers/Dtes/proveedor");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

const router = express.Router();

router.get("/:id", authMiddleware,
  checkRol(["User", "Admin"]),  getProveedorSoftland);


module.exports = router;