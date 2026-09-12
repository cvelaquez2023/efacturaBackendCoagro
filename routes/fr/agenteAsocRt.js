const express = require("express");

const {
  getAgentesAsocRt,
  getAgenteAsocRt,
  postAgenteAsocRt,
  putAgenteAsocRt,
  deleteAgenteAsocRt,
} = require("../../controllers/fr/agenteAsocRt");

const router = express.Router();

router.get("/", getAgentesAsocRt);
router.get("/:agente", getAgenteAsocRt);
router.post("/", postAgenteAsocRt);
router.put("/:agente", putAgenteAsocRt);
router.delete("/:agente", deleteAgenteAsocRt);

module.exports = router;
