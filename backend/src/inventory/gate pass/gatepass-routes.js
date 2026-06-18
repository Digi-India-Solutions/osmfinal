import express from "express";
import {
  createGatePass,
  updateGatePass,
  deleteGatePass,
  getAllGatePasses,
  getGatePassById,
  markAsReturned,
  verifyGatePass,
  rejectGatePass,
  recreateGatePass,
  getGatePassStats,
} from "./gatepass-controller.js";

import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

import { getLinkedDocs } from "./LinkedDocs-controller.js";

const router = express.Router();

router.use(verifyToken);

router.get('/linked-docs', getLinkedDocs);

// stats first (before /:id)
router.get("/stats",           getGatePassStats);

// main CRUD
router.get("/",                getAllGatePasses);
router.post("/",               createGatePass);
router.get("/:id",             getGatePassById);
router.put("/:id",             updateGatePass);
router.delete("/:id",          deleteGatePass);

// outward only
router.post("/:id/recreate",   recreateGatePass);
router.post("/:id/verify",     verifyGatePass);
router.post("/:id/reject",     rejectGatePass);
router.post("/:id/return",     markAsReturned);


export default router;