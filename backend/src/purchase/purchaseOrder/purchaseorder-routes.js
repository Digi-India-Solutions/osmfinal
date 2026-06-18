import express from "express";
import {
   createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  updatePurchaseOrder,
  cancelPurchaseOrder,
} from "./purchaseorder-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(verifyToken);

// ✅ CREATE PO
router.post(
  "/",
  verifyToken, // ensures req.user exists
  createPurchaseOrder
);

// ✅ GET ALL PO (with filters + search)
router.get(
  "/",
  verifyToken,
  getAllPurchaseOrders
);

router.get("/stats", verifyToken, getPurchaseOrderStats);

router.patch(
  "/cancel/:id",
  verifyToken,
  cancelPurchaseOrder
);

// ✅ GET SINGLE PO BY ID
router.get(
  "/:id",
  verifyToken,
  getPurchaseOrderById
);

// ✅ DELETE PO
router.delete(
  "/:id",
  verifyToken,
  deletePurchaseOrder
);



router.put("/:id",verifyToken, updatePurchaseOrder);

export default router;