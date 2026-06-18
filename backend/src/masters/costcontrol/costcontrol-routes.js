import express from "express";
import {
  createCostCenter,
  getAllCostCenters,
  updateCostCenter,
  deleteCostCenter
} from "./costcontrol-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all cost center routes
router.use(verifyToken);

router.post("/create", createCostCenter);
router.get("/", getAllCostCenters);
router.put("/:id", updateCostCenter);
router.delete("/:id", deleteCostCenter);

export default router;
