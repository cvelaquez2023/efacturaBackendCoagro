const express = require("express");

const {
  getLineasNegocio,
  getLineaNegocio,
  postLineaNegocio,
  putLineaNegocio,
  deleteLineaNegocio,
} = require("../../controllers/fr/lineaNegocio");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getLineasNegocio);
router.get("/:id", authMiddleware, checkRol(["Admin", "Fr"]), getLineaNegocio);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postLineaNegocio);
router.put("/:id", authMiddleware, checkRol(["Admin", "Fr"]), putLineaNegocio);
router.delete("/:id", authMiddleware, checkRol(["Admin", "Fr"]), deleteLineaNegocio);

module.exports = router;
