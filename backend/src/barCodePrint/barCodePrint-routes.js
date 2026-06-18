import { Router } from "express";
import { verifyToken } from "../../middlewares/verifyToken.middleware.js"
import { getLabelSettings, saveLabelSettings } from "./barCodePrint-controller.js";


const router = Router();

router.use(verifyToken);
router.get("/get-label-settings",  getLabelSettings);
router.post("/save-label-settings", saveLabelSettings);


export default router;