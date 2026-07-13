// src/routes/checkerPerformance.routes.js

import { Router } from 'express';
import {
  getCheckerPerformance,
  getCheckerDetail,
  getRecheckerPerformance,
} from './checkerPerformanceController.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── CHECKER PERFORMANCE ROUTES ───────────────────────────────

// Get checker performance (optionally filter by exam)
router.get('/exams/:examId/performance', verifyToken, getCheckerPerformance);

// Get checker performance for all exams
router.get('/performance', verifyToken, getCheckerPerformance);

// Get checker detail
router.get('/checkers/:checkerId/detail', verifyToken, getCheckerDetail);

// Get rechecker performance
router.get('/recheckers/performance', verifyToken, getRecheckerPerformance);

export default router;
