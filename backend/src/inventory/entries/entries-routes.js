import express from "express";
import {
  createDSE,
  deleteDSE,
  getDSEList,
  getSingleDSE,
  updateDSE
} from "./entries-controller.js";

import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
// adjust path as per your project

const router = express.Router();

// ─────────────────────────────
// CREATE DIRECT STOCK ENTRY
// ─────────────────────────────
router.post(
  "/",
  verifyToken,
  createDSE
);

// ─────────────────────────────
// GET ALL DSE LIST (filters + pagination)
// ─────────────────────────────
router.get(
  "/",
  verifyToken,
  getDSEList
);

// ─────────────────────────────
// GET SINGLE DSE BY ID
// ─────────────────────────────
router.get(
  "/:id",
  verifyToken,
  getSingleDSE
);

router.put("/:id", verifyToken, updateDSE);
router.delete("/:id", verifyToken, deleteDSE);

export default router;
