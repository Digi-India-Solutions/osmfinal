import express from "express";
import {
  createRejectionCode,
  getAllRejectionCodes,
  updateRejectionCode,
  deleteRejectionCode
} from "./rejectioncode-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all rejection code routes
router.use(verifyToken);

router.post("/create", createRejectionCode);
router.get("/", getAllRejectionCodes);
router.put("/:id", updateRejectionCode);
router.delete("/:id", deleteRejectionCode);

export default router;
