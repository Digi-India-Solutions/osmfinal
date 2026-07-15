import { Router } from 'express';
import {
  getUnassignedSheets,
  getAvailableCheckers,
  assignSheets,
  randomAssignment,
  getAssignmentsByExam,
  getAssignmentsByChecker,
  unassignSheet,
  getMyAssignedSheets,
  getSheetForMarking,
  updateCheckerSheetStatus,
  saveDraftMarks,
} from './assignmentController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── ADMIN ASSIGNMENT ROUTES ──────────────────────────────────

router.get(
  '/exams/:examId/sheets/unassigned',
  verifyToken,
  getUnassignedSheets,
);
router.get(
  '/exams/:examId/checkers/available',
  verifyToken,
  getAvailableCheckers,
);
router.post('/exams/:examId/assign', verifyToken, assignSheets);
router.post('/exams/:examId/assign/random', verifyToken, randomAssignment);
router.get('/exams/:examId/assignments', verifyToken, getAssignmentsByExam);
router.get(
  '/checkers/:checkerId/assignments',
  verifyToken,
  getAssignmentsByChecker,
);
router.delete('/assignments/:assignmentId', verifyToken, unassignSheet);

// ─── CHECKER WORK QUEUE ROUTES ─────────────────────────────

router.get('/my-sheets', verifyToken, getMyAssignedSheets);
router.get('/sheet/:id', verifyToken, getSheetForMarking);
router.patch('/sheet/:id/status', verifyToken, updateCheckerSheetStatus);
router.post('/sheet/:id/draft', verifyToken, saveDraftMarks);

export default router;
