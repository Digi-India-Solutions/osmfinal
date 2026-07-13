// src/routes/result.routes.js

import { Router } from 'express';
import {
  getExamResults,
  getPublishedExams,
  publishExamResults,
  getExamSummary,
  getRecentResults,
} from './reportTabController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── RESULT ROUTES ─────────────────────────────────────────────

// ✅ Get results for a specific exam
router.get('/exams/:examId/results', verifyToken, getExamResults);

// ✅ Get published exams
router.get('/published', verifyToken, getPublishedExams);

// ✅ Publish exam results
router.post('/exams/:examId/publish', verifyToken, publishExamResults);

// ✅ Get exam summary
router.get('/exams/:examId/summary', verifyToken, getExamSummary);

// ✅ Get recent results
router.get('/recent', verifyToken, getRecentResults);

export default router;
