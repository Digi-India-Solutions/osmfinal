import { Router } from 'express';
import {
  createExam,
  getAllExams,
  getSingleExam,
  updateExam,
  deleteExam,
} from './exam-management-controller.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();
// verifyToken,
router.post('/exams',  createExam);
router.get('/exams',  getAllExams);
router.get('/exams/:id', verifyToken, getSingleExam);
router.patch('/exams/:id', verifyToken, updateExam);
router.delete('/exams/:id', verifyToken, deleteExam);

export default router;