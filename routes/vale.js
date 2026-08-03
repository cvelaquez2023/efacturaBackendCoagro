const express = require("express");
const { postVale, getVale } = require("../controllers/vale");

const router = express.Router();

router.post("/", postVale);
router.get("/:cajachica", getVale);

module.exports = router;
