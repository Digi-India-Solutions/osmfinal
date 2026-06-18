import express from "express";

import {
  createPayment,
  getAllPayments,
  getPaymentById,
  getPaymentsByInvoice,
  getPaymentStats,
  updateChequeStatus,
  deletePayment,
  updatePayment,
} from "./payment-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

router.use(verifyToken);

// GET  /api/purchase-payments/stats                   — summary totals + cheque counts
router.get("/stats", getPaymentStats);

// GET  /api/purchase-payments                         — history page (all vouchers + filters)
router.get("/", getAllPayments);

// POST /api/purchase-payments                         — record new payment
router.post("/", createPayment);

// GET  /api/purchase-payments/invoice/:invoiceId      — all payments for one invoice
router.get("/invoice/:invoiceId", getPaymentsByInvoice);

// GET  /api/purchase-payments/:id                     — single voucher detail
router.get("/:id", getPaymentById);

// PATCH /api/purchase-payments/:id/cheque-status      — update PENDING cheque to CLEARED/BOUNCED
router.patch("/:id/cheque-status", updateChequeStatus);

// DELETE /api/purchase-payments/:id                   — delete (only non-cleared)
router.delete("/:id", deletePayment);

router.put("/:id", updatePayment);

export default router;