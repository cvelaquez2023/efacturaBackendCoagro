const express = require("express");

const { getFletesRuta, getFleteRuta, putFleteRuta, putFleteRutas } = require("../../controllers/fr/fleteRuta");

const router = express.Router();

router.get("/", getFletesRuta);
router.get("/:ruta", getFleteRuta);
router.put("/", putFleteRutas);
router.put("/:ruta", putFleteRuta);

module.exports = router;
