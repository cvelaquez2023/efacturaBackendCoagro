const express = require("express");
const {
  getItems,
  getItem,
  updateItem,
  putVisitas,
} = require("../controllers/clasificaciones");
const customHeader = require("../middleware/customHeader");
const authMiddleware = require("../middleware/session");
const checkRol = require("../middleware/rol");
const { validateUpdate } = require("../validators/clasificacion");
const router = express.Router();

router.get("/", getItems);
router.put("/visitas", putVisitas);
router.post("/:id", authMiddleware, customHeader, checkRol(["Admin"]), getItem);
router.put(
  "/:id",
  authMiddleware,
  checkRol(["Admin"]),
  validateUpdate,
  updateItem
);

module.exports = router;
