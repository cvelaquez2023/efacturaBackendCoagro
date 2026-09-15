const express = require("express");

const {
  getArticulosRt,
  getArticuloRt,
  postArticuloRt,
  putArticuloRt,
  deleteArticuloRt,
} = require("../../controllers/fr/articuloRt");

const router = express.Router();

router.get("/", getArticulosRt);
router.get("/:articulo", getArticuloRt);
router.post("/", postArticuloRt);
router.put("/:articulo", putArticuloRt);
router.delete("/:articulo", deleteArticuloRt);

module.exports = router;
