import { Router } from "express";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import {
  listSalesInvoices,
  getSalesInvoiceById,
  getSalesInvoicePaymentHistory,
  createSalesInvoice,
  getSalesInvoicePrintData,
  updateSalesInvoice,
  deleteSalesInvoice,
} from "./salesInvoice-controller.js";

const router = Router();
router.use(verifyToken); // Apply authentication middleware to all routes
router.get("/", listSalesInvoices);
router.get("/:id/payment-history", getSalesInvoicePaymentHistory);
router.get("/:id", getSalesInvoiceById);
router.post("/", createSalesInvoice);
router.get("/:id/print", getSalesInvoicePrintData);

router.put("/:id", updateSalesInvoice);
router.delete("/:id", deleteSalesInvoice);

export default router;
