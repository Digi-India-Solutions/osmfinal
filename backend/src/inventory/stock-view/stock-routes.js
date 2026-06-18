import express from "express";
import {
  getStock,
  getLowStock,
  getStockStats,
} from "./stock-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

 
const router = express.Router();
 
router.use(verifyToken);
 
router.get("/stats",     getStockStats);
router.get("/low-stock", getLowStock);
router.get("/",          getStock);
 
export default router;