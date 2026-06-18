import express from "express";
import {
  createRouting,
  getAllRoutings,
  updateRouting,
  deleteRouting,
  getRoutingsForDropdown,
} from './routing-controller.js';
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routing endpoints
router.use(verifyToken);
router.get('/dropdown', getRoutingsForDropdown);
router.post("/create", createRouting);
router.get("/", getAllRoutings);
router.put("/:id", updateRouting);
router.delete("/:id", deleteRouting);

export default router;
