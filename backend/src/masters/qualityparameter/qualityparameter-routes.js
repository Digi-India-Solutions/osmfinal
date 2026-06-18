import express from "express";
import {
  createQualityParameter,
  getAllQualityParameters,
  updateQualityParameter,
  deleteQualityParameter
} from "./qualityparameter-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all quality parameter routes
router.use(verifyToken);

router.post("/create", createQualityParameter);
router.get("/", getAllQualityParameters);
router.put("/:id", updateQualityParameter);
router.delete("/:id", deleteQualityParameter);

export default router;
