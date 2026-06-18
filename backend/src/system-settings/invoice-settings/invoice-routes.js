import express from "express";
import {
  getDocumentSettings,
  updateDocumentSettings,
  getBarcodeSettings,
  updateBarcodeSettings,
  resetBarcodeCounter 
} from "./invoice-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = express.Router();

router.use(verifyToken)

router.get("/get-doc-settings", getDocumentSettings);
router.put("/update-doc-settings", updateDocumentSettings);
// router.put("/reset-doc-settings", resetDocumentSequence);
router.get("/get-barcode-settings", getBarcodeSettings);
router.put("/update-barcode-settings", updateBarcodeSettings);
router.put("/reset-barcode", resetBarcodeCounter);

export default router;
