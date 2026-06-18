import express from "express";
import {
  createWorkCenter,
  getAllWorkCenters,
  updateWorkCenter,
  deleteWorkCenter
} from "./workcenter-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all workcenter routes
router.use(verifyToken);

router.post("/create", createWorkCenter);
router.get("/", getAllWorkCenters);
router.put("/:id", updateWorkCenter);
router.delete("/:id", deleteWorkCenter);

export default router;