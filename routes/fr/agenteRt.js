const express = require("express");

const {
  getAgentesRt,
  getAgenteRt,
  postAgenteRt,
  putAgenteRt,
  deleteAgenteRt,
} = require("../../controllers/fr/agenteRt");

const router = express.Router();

router.get("/", getAgentesRt);
router.get("/:agente", getAgenteRt);
router.post("/", postAgenteRt);
router.put("/:agente", putAgenteRt);
router.delete("/:agente", deleteAgenteRt);

module.exports = router;
