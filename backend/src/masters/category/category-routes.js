import { Router } from "express";

import {createCategory, updateCategory, deleteCategory, getAllCategories, getCategoryById } from "./category-controller.js";
import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";

const router = Router();

router.use(verifyToken);

router.post("/create", createCategory);

router.put("/update/:id", updateCategory);

router.delete("/delete/:id", deleteCategory);

router.get("/all", getAllCategories);

router.get("/:id", getCategoryById)


export default router;