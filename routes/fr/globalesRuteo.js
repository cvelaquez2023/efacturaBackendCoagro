const express = require("express");

const {
  getGlobalesRuteo,
  postGlobalesRuteo,
  putGlobalesRuteo,
  deleteGlobalesRuteo,
} = require("../../controllers/fr/globalesRuteo");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getGlobalesRuteo);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postGlobalesRuteo);
router.put("/", authMiddleware, checkRol(["Admin", "Fr"]), putGlobalesRuteo);
router.delete("/", authMiddleware, checkRol(["Admin", "Fr"]), deleteGlobalesRuteo);

module.exports = router;
