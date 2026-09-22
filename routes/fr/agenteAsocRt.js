const express = require("express");

const {
  getAgentesAsocRt,
  getAgenteAsocRt,
  postAgenteAsocRt,
  putAgenteAsocRt,
  deleteAgenteAsocRt,
} = require("../../controllers/fr/agenteAsocRt");

const authMiddleware = require("../../middleware/session");
const checkRol = require("../../middleware/rol");
const router = express.Router();

router.get("/", authMiddleware, checkRol(["Admin", "Fr"]), getAgentesAsocRt);
router.get(
  "/:agente",
  authMiddleware,
  checkRol(["Admin", "Fr"]),
  getAgenteAsocRt,
);
router.post("/", authMiddleware, checkRol(["Admin", "Fr"]), postAgenteAsocRt);
router.put(
  "/:agente",
  authMiddleware,
  checkRol(["Admin", "Fr"]),
  putAgenteAsocRt,
);
router.delete(
  "/:agente",
  authMiddleware,
  checkRol(["Admin", "Fr"]),
  deleteAgenteAsocRt,
);

module.exports = router;
