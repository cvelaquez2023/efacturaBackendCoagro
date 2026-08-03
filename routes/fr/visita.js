const express = require("express");

const {
  getVisitas,
  getVisita,
  postVisita,
  putVisita,
  deleteVisita,
} = require("../../controllers/fr/visita");

const router = express.Router();

router.get("/", getVisitas);
router.get("/:ruta/:cliente/:inicio", getVisita);
router.post("/", postVisita);
router.put("/:ruta/:cliente/:inicio", putVisita);
router.delete("/:ruta/:cliente/:inicio", deleteVisita);

module.exports = router;
