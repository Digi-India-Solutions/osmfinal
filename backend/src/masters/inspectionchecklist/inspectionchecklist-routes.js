import express from "express";
import {
  createInspectionChecklist,
  getAllInspectionChecklists,
  updateInspectionChecklist,
  deleteInspectionChecklist
} from "./inspectionchecklist-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all inspection checklist routes
router.use(verifyToken);

router.post("/create", createInspectionChecklist);
router.get("/", getAllInspectionChecklists);
router.put("/:id", updateInspectionChecklist);
router.delete("/:id", deleteInspectionChecklist);

export default router;
