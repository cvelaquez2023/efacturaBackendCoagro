const express = require("express");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");
const {
  getDireccion,
  postDireccion,
  putDireccion,
} = require("../controllers/direccion");
const router = express.Router();
router.get("/", authMiddleware, checkRol(["User", "Admin"]), getDireccion);
router.post("/", authMiddleware, checkRol(["User", "Admin"]), postDireccion);
router.put("/", authMiddleware, checkRol(["User"]), putDireccion);

module.exports = router;
