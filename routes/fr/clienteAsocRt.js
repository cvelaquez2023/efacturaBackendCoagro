const express = require("express");

const {
  getClientesAsocRt,
  getClienteAsocRt,
  postClienteAsocRt,
  putClienteAsocRt,
  deleteClienteAsocRt,
} = require("../../controllers/fr/clienteAsocRt");

const router = express.Router();

router.get("/", getClientesAsocRt);
router.get("/:codigo", getClienteAsocRt);
router.post("/", postClienteAsocRt);
router.put("/:codigo", putClienteAsocRt);
router.delete("/:codigo", deleteClienteAsocRt);

module.exports = router;
