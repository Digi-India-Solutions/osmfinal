import { Router } from 'express';
import {
    getUnassignedSheets,
    getAvailableCheckers,
    assignSheets,
    assignSheetsRandomly,
    getAssignmentLogs,
} from './checker-assignment-controller.js';
// import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

router.get('/sheets', getUnassignedSheets);
router.get('/checkers', getAvailableCheckers);
router.post('/assign', assignSheets);
router.post('/assign-random', assignSheetsRandomly);
router.get('/logs', getAssignmentLogs);

export default router;