// src/routes/exam-management.routes.js

import { Router } from 'express';
import {
  createExam,
  getAllExams,
  getSingleExam,
  updateExam,
  deleteExam,
  bulkDeleteExams,
  deleteExamsByFilter,
  getExamDeletionPreview,
} from './exam-management-controller.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── EXAM ROUTES ──────────────────────────────────────────────

router.post('/exams', verifyToken, createExam);
router.get('/exams', verifyToken, getAllExams);
router.get('/exams/deletion-preview', verifyToken, getExamDeletionPreview);
router.get('/exams/:id', verifyToken, getSingleExam);
router.patch('/exams/:id', verifyToken, updateExam);

// ════════════════════════════════════════════════════════════════
// ✅ DELETE ROUTES WITH UUID SUPPORT
// ════════════════════════════════════════════════════════════════

router.delete('/exams/:id', verifyToken, deleteExam);
router.post('/exams/bulk-delete', verifyToken, bulkDeleteExams);
router.delete('/exams', verifyToken, deleteExamsByFilter);

export default router;
