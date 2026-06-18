import express from "express";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import { verifyAdmin } from "../../../middlewares/verifyAdmin.middleware.js";
import {
  listSaleReturns,
  getSaleReturnById,
  createSaleReturn,
  handleReturnPayment,
  updateSaleReturn,
  deleteSaleReturn,
} from "./saleReturn-controller.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// All routes require authentication
// ─────────────────────────────────────────────────────────────

// GET    /sales/returns          — List all returns   (RETURN_ENTRY role)
router.get(
  "/",
  verifyToken,
  verifyAdmin("RETURN_ENTRY"),
  listSaleReturns
);

// POST   /sales/returns          — Create a return    (RETURN_ENTRY role)
router.post(
  "/",
  verifyToken,
  verifyAdmin("RETURN_ENTRY"),
  createSaleReturn
);

// GET    /sales/returns/:id      — Get single return  (RETURN_ENTRY role)
router.get(
  "/:id",
  verifyToken,
  verifyAdmin("RETURN_ENTRY"),
  getSaleReturnById
);

// PATCH  /sales/returns/:id/payment — Handle refund/credit (PAYMENT_ENTRY role)
router.patch(
  "/:id/payment",
  verifyToken,
  verifyAdmin("PAYMENT_ENTRY"),
  handleReturnPayment
);


router.put("/:id",verifyToken, updateSaleReturn);
router.delete("/:id",verifyToken, deleteSaleReturn);

export default router;
