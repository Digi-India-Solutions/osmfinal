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

// Get student by ID
router.get('/students/:id', verifyToken, getStudentById);

// Update student
router.put('/students/:id', verifyToken, updateStudent);

// Delete student
router.delete('/students/:id', verifyToken, deleteStudent);

// Bulk delete students
router.post('/students/bulk-delete', verifyToken, bulkDeleteStudents);
router.post('/students/auto-link', verifyToken, autoLinkStudentsToExams);

export default router;
