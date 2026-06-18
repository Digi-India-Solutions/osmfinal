import { getStockSummary, getStockLedger, getLowStock, getPurchaseInvoiceRegister, getGSTPurchaseRegister, getSalesRegister, getGSTSalesRegister, getOutstanding, getDayBook, getPartyLedger } from "./reports-controller.js"
import express from "express";
const router = express.Router();



// GET  /api/stock-summary                          
router.get("/stock-summary", getStockSummary);
router.get("/stock-ledger", getStockLedger)
router.get("/low-stock", getLowStock)
router.get("/purchase-register", getPurchaseInvoiceRegister)
router.get("/gst-purchase", getGSTPurchaseRegister)
router.get("/sales-register", getSalesRegister);
router.get("/gst-sales", getGSTSalesRegister)
router.get("/outstanding", getOutstanding);
router.get("/day-book", getDayBook);
router.get("/party-ledger", getPartyLedger)


export default router;