import express from "express";
import {
  createParty,
  getAllParties,
  updateParty,
  deleteParty,

  getPartyById,
  filterParties,
  getSuppliers,
  getCustomers

} from "./parties-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
const router = express.Router();

// Apply authentication middleware to all lead routes
router.use(verifyToken);

router.post("/", createParty);
router.get("/", getAllParties);

//router.post("/search", searchParties); 
router.get("/search", filterParties);
router.get("/suppliers", getSuppliers);
router.get("/customers", getCustomers);
router.get("/:id", getPartyById);
router.put("/:id", updateParty);
router.delete("/:id", deleteParty);



export default router;