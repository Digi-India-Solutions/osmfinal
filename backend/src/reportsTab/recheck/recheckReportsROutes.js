// src/routes/recheckReport.routes.js

import { Router } from 'express';
import {
  getRecheckReport,
  getRecheckSummary,
  getRecheckDetail,
} from './recheckReportController.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── RECHECK REPORT ROUTES ─────────────────────────────────────

// Get recheck report for an exam
router.get('/exams/:examId/recheck-report', verifyToken, getRecheckReport);

// Get recheck summary for an exam
router.get('/exams/:examId/recheck-summary', verifyToken, getRecheckSummary);

// Get recheck detail by request ID
router.get('/recheck-requests/:id/detail', verifyToken, getRecheckDetail);

export default router;
