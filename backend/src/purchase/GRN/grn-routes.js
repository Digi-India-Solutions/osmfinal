import express from "express";
import {
  createGRN,
  getAllGRNs,
  getGRNById,
  getGRNsBySupplier,
  getGRNStats,
  deleteGRN,
  updateGRN,
} from "./grn-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// All routes protected
router.use(verifyToken);

// ── Stats (before /:id so it doesn't get swallowed) ──
router.get("/stats", getGRNStats);

// ── GRNs for a specific supplier (used when creating invoice) ──
router.get("/supplier/:supplier_id", getGRNsBySupplier);

// ── Main CRUD ──
router.get("/",    getAllGRNs);
router.post("/",   createGRN);
router.get("/:id", getGRNById);
router.delete("/:id", deleteGRN);

router.put("/:id", updateGRN);

export default router;