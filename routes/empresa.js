const express = require("express");
const { getEmpresa, postEmpresa } = require("../controllers/empresa");

const router = express.Router();

router.get("/:id", getEmpresa);
router.post("/", postEmpresa);

module.exports = router;
