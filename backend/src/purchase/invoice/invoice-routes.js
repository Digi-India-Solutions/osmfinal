import express from "express";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import {
  createPurchaseInvoice,
  getAllPurchaseInvoices,
  getPurchaseInvoiceById,
  getPurchaseInvoiceStats,
  recordPayment,
  deletePurchaseInvoice,
  getActivePurchaseInvoices,
  duplicatePurchaseInvoice,
  updatePurchaseInvoice
} from "./invoice-controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET  /api/purchase-invoices/stats     — summary counts + totals
router.get("/stats", getPurchaseInvoiceStats);

// GET  /api/purchase-invoices           — list with filters
router.get("/", getAllPurchaseInvoices);

// GET  /api/purchase-invoices/active    — list active invoices with filters
router.get("/active", getActivePurchaseInvoices);

// POST /api/purchase-invoices           — create new invoice
router.post("/", createPurchaseInvoice);


// GET  /api/purchase-invoices/:id       — get single invoice with items
router.get("/:id", getPurchaseInvoiceById);

// DELETE /api/purchase-invoices/:id     — delete (only if no payments)
router.delete("/:id", deletePurchaseInvoice);

router.put("/:id", updatePurchaseInvoice);

// POST /api/purchase-invoices/:id/payment — record a payment
router.post("/:id/payment", recordPayment);


router.post("/:id/duplicate", duplicatePurchaseInvoice);

export default router;