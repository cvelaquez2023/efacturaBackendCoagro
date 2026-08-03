const express = require("express");

const {
  postDocumentoCp,
  postDocumentoCpSuj,
} = require("../controllers/documentosCp");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");

const router = express.Router();

router.post("/",authMiddleware, checkRol(["Admin"]), postDocumentoCp);
router.post("/sujetoExcluido",authMiddleware, checkRol(["Admin"]), postDocumentoCpSuj);
module.exports = router;
