import express from "express";
import {
  createWarehouse,
  getAllWarehouses,
  updateWarehouse,
  deleteWarehouse,

  searchWarehouses,
  getAllWarehousesUsingMarterTab,
  getWarehousesForUser

} from "./warehouse-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
const router = express.Router();

// Apply authentication middleware to all lead routes
router.use(verifyToken);

router.post("/", createWarehouse);
router.get("/", getAllWarehouses);
router.get("/getallwarehouses", getAllWarehousesUsingMarterTab);
router.get("/assigned", getWarehousesForUser);
router.post("/search", searchWarehouses);


router.put("/:id", updateWarehouse);
router.delete("/:id", deleteWarehouse);




export default router;