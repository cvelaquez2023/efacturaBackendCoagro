const express = require("express");

const {
  getGlobalesRuteo,
  postGlobalesRuteo,
  putGlobalesRuteo,
  deleteGlobalesRuteo,
} = require("../../controllers/fr/globalesRuteo");

const router = express.Router();

router.get("/", getGlobalesRuteo);
router.post("/", postGlobalesRuteo);
router.put("/", putGlobalesRuteo);
router.delete("/", deleteGlobalesRuteo);

module.exports = router;
