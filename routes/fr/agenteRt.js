const express = require("express");

const {
  getAgentesRt,
  getAgenteRt,
  postAgenteRt,
  putAgenteRt,
  deleteAgenteRt,
} = require("../../controllers/fr/agenteRt");

const router = express.Router();

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getAgentesRt);
router.get("/:agente", authMiddleware, checkRol(["Admin", "Fr"]), getAgenteRt);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postAgenteRt);
router.put("/:agente", authMiddleware, checkRol(["Admin", "Fr"]), putAgenteRt);
router.delete("/:agente", authMiddleware, checkRol(["Admin", "Fr"]), deleteAgenteRt);

module.exports = router;
