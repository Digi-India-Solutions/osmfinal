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

// Create exam
router.post('/exams', verifyToken, createExam);

// Get all exams with filters
router.get('/exams', verifyToken, getAllExams);

// Get deletion preview (MUST be before /exams/:id)
router.get('/exams/deletion-preview', verifyToken, getExamDeletionPreview);

// Get single exam
router.get('/exams/:id', verifyToken, getSingleExam);

// Update exam
router.patch('/exams/:id', verifyToken, updateExam);

// ════════════════════════════════════════════════════════════════
// ✅ DELETE ROUTES WITH UUID SUPPORT
// ════════════════════════════════════════════════════════════════

// Delete single exam (UUID support)
router.delete('/exams/:id', verifyToken, deleteExam);

// Bulk delete exams (UUID array support)
router.post('/exams/bulk-delete', verifyToken, bulkDeleteExams);

// Delete exams by filter (UUID support)
router.delete('/exams', verifyToken, deleteExamsByFilter);

export default router;
