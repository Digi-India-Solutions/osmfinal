import { Router } from "express";

import {createUnit,  updateUnit, deleteUnit, getAllUnits, toggleUnitStatus, getUnitById } from "./units-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = Router();

router.use(verifyToken);

router.post("/create", createUnit);

router.put("/update/:id", updateUnit);

router.delete("/delete/:id", deleteUnit);

router.get("/all", getAllUnits);

router.patch("/:id/toggle", toggleUnitStatus);

router.get("/:id", getUnitById);


export default router;