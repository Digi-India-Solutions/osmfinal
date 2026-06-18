import express from "express";
import {
  createAdjustment,
  getAllAdjustments,
  getAdjustmentById,
  getAdjustmentStats,
  updateAdjustment,
  deleteAdjustment,
} from "./adjustment-controller.js";

import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/stats", getAdjustmentStats);
router.get("/", getAllAdjustments);
router.post("/", createAdjustment);
router.get("/:id", getAdjustmentById);
router.put("/:id", updateAdjustment);
router.delete("/:id", deleteAdjustment);

export default router;