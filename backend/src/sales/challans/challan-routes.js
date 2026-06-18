import { Router } from "express";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import {
  listChallans,
  getChallanById,
  createChallan,
  convertChallanToInvoice,
  updateChallan,
  deleteChallan,
} from "./challan-controller.js";

const router = Router();

router.get("/", verifyToken, listChallans);
router.get("/:id", verifyToken, getChallanById);
router.post("/", verifyToken, createChallan);
router.patch("/:id/convert", verifyToken, convertChallanToInvoice);
router.put("/:id", verifyToken, updateChallan);
router.delete("/:id", verifyToken, deleteChallan);
export default router;
