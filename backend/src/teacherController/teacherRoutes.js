// src/routes/teacher.routes.js

import { Router } from 'express';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';
import {
  getTeacherDashboard,
  getTeacherExams,
  createExam,
  updateExam,
  deleteExam,
  getTeacherSheets,
  getSheetDetails,
  uploadSheet,
  deleteSheet,
  getMarkScheme,
  saveMarkScheme,
  uploadModelAnswer,
  uploadQuestionPaper,
  deletePDF,
  getCheckingProgress,
  getResults,
  requestRecheck,
  getRecheckRequests,
  updateRecheckStatus,
  getTeacherStats,
} from './teacherController.js';

const router = Router();

// ─── DASHBOARD ──────────────────────────────────────────────
router.get('/dashboard', verifyToken, getTeacherDashboard);

// ─── EXAMS ──────────────────────────────────────────────────
router.get('/exams', verifyToken, getTeacherExams);
router.post('/exams', verifyToken, createExam);
router.put('/exams/:id', verifyToken, updateExam);
router.delete('/exams/:id', verifyToken, deleteExam);

// ─── SHEETS ──────────────────────────────────────────────────
router.get('/sheets', verifyToken, getTeacherSheets);
router.get('/sheets/:id', verifyToken, getSheetDetails);
router.post('/sheets/upload', verifyToken, uploadSheet);
router.delete('/sheets/:id', verifyToken, deleteSheet);

// ─── MARK SCHEME ────────────────────────────────────────────
router.get('/mark-scheme/:examId', verifyToken, getMarkScheme);
router.post('/mark-scheme/:examId', verifyToken, saveMarkScheme);
router.post(
  '/mark-scheme/:examId/model-answer',
  verifyToken,
  uploadModelAnswer,
);
router.post(
  '/mark-scheme/:examId/question-paper',
  verifyToken,
  uploadQuestionPaper,
);
router.delete('/mark-scheme/:examId/pdf/:type', verifyToken, deletePDF);

// ─── PROGRESS ───────────────────────────────────────────────
router.get('/progress/:examId', verifyToken, getCheckingProgress);

// ─── RESULTS ────────────────────────────────────────────────
router.get('/results/:examId', verifyToken, getResults);

// ─── DISPUTES / RECHECK ────────────────────────────────────
router.post('/recheck/request', verifyToken, requestRecheck);
router.get('/recheck/requests', verifyToken, getRecheckRequests);
router.patch('/recheck/:id/status', verifyToken, updateRecheckStatus);

// ─── STATISTICS ─────────────────────────────────────────────
router.get('/stats', verifyToken, getTeacherStats);

export default router;
