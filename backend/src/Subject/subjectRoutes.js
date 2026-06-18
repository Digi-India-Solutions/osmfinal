// src/routes/subject.routes.js
import { Router } from 'express';
import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleSubjectStatus,
  bulkDeleteSubjects,
  getSubjectStats,
  searchSubjects,
  getSubjectsByDepartment,
} from '../Subject/subjectController.js';

const router = Router();

// ─── SUBJECT ROUTES ──────────────────────────────────────────────────────

// GET /api/v1/auth/subjects - Get all subjects (with filters)
router.get('/subjects', getSubjects);

// GET /api/v1/auth/subjects/stats - Get subject statistics
router.get('/subjects/stats', getSubjectStats);

// GET /api/v1/auth/subjects/search - Search subjects
router.get('/subjects/search', searchSubjects);

// GET /api/v1/auth/subjects/department/:department - Get subjects by department
router.get('/subjects/department/:department', getSubjectsByDepartment);

// GET /api/v1/auth/subjects/:id - Get subject by ID
router.get('/subjects/:id', getSubjectById);

// POST /api/v1/auth/subjects - Create new subject
router.post('/subjects', createSubject);

// PUT /api/v1/auth/subjects/:id - Update subject
router.put('/subjects/:id', updateSubject);

// PATCH /api/v1/auth/subjects/:id/toggle-status - Toggle subject status
router.patch('/subjects/:id/toggle-status', toggleSubjectStatus);

// DELETE /api/v1/auth/subjects/:id - Delete subject
router.delete('/subjects/:id', deleteSubject);

// POST /api/v1/auth/subjects/bulk-delete - Bulk delete subjects
router.post('/subjects/bulk-delete', bulkDeleteSubjects);

export default router;
