const express = require("express");

const {
  getVisitas,
  getVisita,
  postVisita,
  putVisita,
  deleteVisita,
} = require("../../controllers/fr/visita");

const router = express.Router();
const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");


router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getVisitas);
router.get("/:ruta/:cliente/:inicio", authMiddleware, checkRol(["Admin", "Fr"]), getVisita);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postVisita);
router.put("/:ruta/:cliente/:inicio", authMiddleware, checkRol(["Admin", "Fr"]), putVisita);
router.delete("/:ruta/:cliente/:inicio", authMiddleware, checkRol(["Admin", "Fr"]), deleteVisita);

module.exports = router;
