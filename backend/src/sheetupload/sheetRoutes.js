// src/routes/sheet.routes.js
import { Router } from 'express';
import {
  uploadSheets,
  autoLinkSheets,
  getSheetsByExam,
  getSheetById,
  updateSheetMarks,
  deleteSheet,
  getSheetStats,
  getUnlinkedSheets,
  getUnlinkedStudents,
  manualLinkStudent,
  getStudentLinkingStatus,
} from './sheetController.js';
import { uploadSheets as uploadSheetsMiddleware } from '../../middlewares/multer.middleware.js';
import { multerErrorHandler } from '../../middlewares/multerErrorHadler.middleware.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── SHEET ROUTES ───────────────────────────────────────────────

// Upload sheets
router.post(
  '/exams/:examId/sheets/upload',
  verifyToken,
  uploadSheetsMiddleware.array('sheets', 50),
  multerErrorHandler,
  uploadSheets,
);

// Auto-link sheets by barcode
router.post('/exams/:examId/sheets/auto-link', verifyToken, autoLinkSheets);

// Get sheets by exam
router.get('/exams/:examId/sheets', verifyToken, getSheetsByExam);

// Get sheet stats
router.get('/exams/:examId/sheets/stats', verifyToken, getSheetStats);

// ✅ Get unlinked sheets
router.get('/exams/:examId/sheets/unlinked', verifyToken, getUnlinkedSheets);

// ✅ Get unlinked students
router.get(
  '/exams/:examId/students/unlinked',
  verifyToken,
  getUnlinkedStudents,
);

// ✅ Get student linking status
router.get(
  '/exams/:examId/students/linking-status',
  verifyToken,
  getStudentLinkingStatus,
);

// ✅ Manual link student to sheet
router.post(
  '/exams/:examId/students/manual-link',
  verifyToken,
  manualLinkStudent,
);

// Get sheet by ID
router.get('/sheets/:id', verifyToken, getSheetById);

// Update sheet marks
router.put('/sheets/:id', verifyToken, updateSheetMarks);

// Delete sheet
router.delete('/sheets/:id', verifyToken, deleteSheet);

export default router;
