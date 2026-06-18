import express from "express";
import {
  createTransfer,
  approveTransfer,
  getAllTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
} from "./transfer-controller.js";

import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/",     getAllTransfers);
router.post("/",    createTransfer);
router.get("/:id",  getTransferById);
router.patch("/:id/approve", approveTransfer);

router.put("/:id", updateTransfer);
router.delete("/:id", deleteTransfer);

export default router;