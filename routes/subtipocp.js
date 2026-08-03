const express = require("express");
const { getSubTipoCp } = require("../controllers/subtipocp");

const router = express.Router();

router.get("/:id", getSubTipoCp);
module.exports = router;
