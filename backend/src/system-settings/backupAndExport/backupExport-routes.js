import { Router } from "express";

import { verifyToken } from "../../../middlewares/verifyToken.middleware.js";
import { requireRole } from "../../../middlewares/role.middlewere.js";
import { exportData, getBackups, triggerBackup, restoreBackup } from "./backupExport-controller.js";

const router = Router();

// router.use(verifyToken);

router.post(
    '/backup',
    verifyToken,
     triggerBackup
);

router.get(
    '/export/:type',
        verifyToken,
      exportData
);

router.get(
    '/list', verifyToken, getBackups
)

router.post('/restore',   verifyToken, restoreBackup);

export default router;