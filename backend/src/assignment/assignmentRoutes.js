// src/routes/assignment.routes.js
import { Router } from 'express';
import {
  getUnassignedSheets,
  getAvailableCheckers,
  assignSheets,
  randomAssignment,
  getAssignmentsByExam,
  getAssignmentsByChecker,
  unassignSheet,
} from './assignmentController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── ASSIGNMENT ROUTES ──────────────────────────────────────────

// Get unassigned sheets for an exam
router.get(
  '/exams/:examId/sheets/unassigned',
  verifyToken,
  getUnassignedSheets,
);

// Get available checkers for an exam
router.get(
  '/exams/:examId/checkers/available',
  verifyToken,
  getAvailableCheckers,
);

// Assign sheets to a checker
router.post('/exams/:examId/assign', verifyToken, assignSheets);

// Random assignment
router.post('/exams/:examId/assign/random', verifyToken, randomAssignment);

// Get all assignments for an exam
router.get('/exams/:examId/assignments', verifyToken, getAssignmentsByExam);

// Get assignments for a checker
router.get(
  '/checkers/:checkerId/assignments',
  verifyToken,
  getAssignmentsByChecker,
);

// Unassign a sheet
router.delete('/assignments/:assignmentId', verifyToken, unassignSheet);

export default router;
