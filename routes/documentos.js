const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");
const { getDocumentos, putDocumento } = require("../controllers/documentos");
const getAnulados = require("../controllers/anulaciones");

router.get("/", authMiddleware, checkRol(["User"]), getDocumentos);
router.put("/:fac", authMiddleware, checkRol(["User", "Admin"]), putDocumento);
router.get(
  "/anulados/:ano/:mes",
  authMiddleware,
  checkRol(["User", "Admin","FAC"]),
  getAnulados
);
module.exports = router;
