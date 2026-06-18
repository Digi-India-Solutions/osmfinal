import express from "express";
import {
  createPurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnById,
  handleReturnPayment,
 
  getPurchaseReturnStats,
  updatePurchaseReturn,
  deletePurchaseReturn,
} from "./return-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

router.use(verifyToken);

// GET  /api/purchase-returns/stats                   — counts + totals
router.get("/stats", getPurchaseReturnStats);

// No need for a separate supplier-credits endpoint since we can calculate it from the stats or list endpoints. If needed, we can add a query param to filter by supplier in the existing endpoints.
// GET  /api/purchase-returns/supplier-credits        — unused credits per supplier
//router.get("/supplier-credits", getSupplierCredits);


// GET  /api/purchase-returns                         — list with filters
router.get("/", getAllPurchaseReturns);

// POST /api/purchase-returns                         — create new return
router.post("/", createPurchaseReturn);

// GET  /api/purchase-returns/:id                     — detail with items
router.get("/:id", getPurchaseReturnById);

// POST /api/purchase-returns/:id/handle-payment      — mark credit or refund
// Body: { type: 'credit'|'refund', refundMode?, referenceNo? }
router.post("/:id/handle-payment", handleReturnPayment);

//No need for separate endpoints to mark credit used since we can handle that in the same handle-payment endpoint by passing the appropriate type and details in the request body. If needed, we can add a query param or a specific field in the body to indicate that it's for marking credit used.
// PATCH /api/purchase-returns/:id/mark-credit-used   — consume credit on invoice
// Body: { invoiceId }
//router.patch("/:id/mark-credit-used", markCreditUsed);

router.put("/:id", updatePurchaseReturn);

// ✅ DELETE PO
router.delete("/:id",  deletePurchaseReturn);
// POST  /api/purchase-returns/:id/handle-payment      — mark credit or refund
// Body: { paymentType: 'REFUND'|'CREDIT', paymentMode?, amount, adjustmentAmount? }
router.post("/:id/handle-payment",      handleReturnPayment);

// PATCH /api/purchase-returns/:id/handle-payment      — mark credit or refund (standard PATCH)
// Body: { paymentType: 'REFUND'|'CREDIT', paymentMode?, amount, adjustmentAmount? }
router.patch("/:id/handle-payment",     handleReturnPayment);

// PATCH /api/purchase-returns/:id/payment            — mark credit or refund (alternate path)
router.patch("/:id/payment",            handleReturnPayment);




export default router;