import { Router } from "express";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import {
  listSalesPayments,
  listSalesReturnSettlements,
  createSalesPayment,
  updateSalesPaymentChequeStatus,
  getSalesPaymentById,
  getSalesPaymentPrintData,
  updateSalesPayment,
  deleteSalesPayment,
} from "./salesPayment-controller.js";

const router = Router();

// Image-aligned routes
router.get("/payments/receipts", verifyToken, listSalesPayments);
router.get("/returns/receipts", verifyToken, listSalesReturnSettlements);
router.post("/payments/receipts", verifyToken, createSalesPayment);
router.get("/payments/receipts/:id", verifyToken, getSalesPaymentById);
router.patch("/payments/receipts/:id/cheque-status", verifyToken, updateSalesPaymentChequeStatus);
router.get("/payments/receipts/:id/print", verifyToken, getSalesPaymentPrintData);

// Backward-compatible aliases
router.get("/", verifyToken, listSalesPayments);
router.get("/returns", verifyToken, listSalesReturnSettlements);
router.post("/", verifyToken, createSalesPayment);
router.get("/:id", verifyToken, getSalesPaymentById);
router.patch("/:id/cheque-status", verifyToken, updateSalesPaymentChequeStatus);
router.get("/:id/print", verifyToken, getSalesPaymentPrintData);

router.put("/:id", verifyToken, updateSalesPayment);
router.delete("/:id", verifyToken, deleteSalesPayment);

export default router;
