// src/routes/student.routes.js
import { Router } from 'express';
import {
  uploadAndPreview,
  importStudents,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  autoLinkStudentsToExams,
  bulkDeleteStudents,
  deleteStudentsByFilter,
  getDeletionPreview,
} from '../students/studentController.js';
import { uploadExcel } from '../../middlewares/multer.middleware.js';
import { multerErrorHandler } from '../../middlewares/multerErrorHadler.middleware.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── STUDENT ROUTES ─────────────────────────────────────────────

// Upload and preview Excel
router.post(
  '/students/upload',
  verifyToken,
  uploadExcel.single('file'),
  multerErrorHandler,
  uploadAndPreview,
);

// Import students from uploaded file
router.post('/students/import', verifyToken, importStudents);

// Get all students (with filters and exam name)
router.get('/students', verifyToken, getStudents);

// ✅ Get deletion preview (before deleting)
router.get('/students/deletion-preview', verifyToken, getDeletionPreview);

// Get student by ID
router.get('/students/:id', verifyToken, getStudentById);

// Update student
router.put('/students/:id', verifyToken, updateStudent);

// ════════════════════════════════════════════════════════════════
// ✅ DELETE ROUTES WITH CASCADE
// ════════════════════════════════════════════════════════════════

// Delete single student (cascades to sheets)
router.delete('/students/:id', verifyToken, deleteStudent);

// Bulk delete students (cascades to sheets)
router.post('/students/bulk-delete', verifyToken, bulkDeleteStudents);

// Delete students by filter (cascades to sheets)
router.delete('/students', verifyToken, deleteStudentsByFilter);

// Auto-link students to exams
router.post('/students/auto-link', verifyToken, autoLinkStudentsToExams);

export default router;
