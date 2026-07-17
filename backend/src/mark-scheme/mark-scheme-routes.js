// src/routes/mark-scheme.routes.js

import { Router } from 'express';
import {
  getMarkSchemeByExam,
  saveMarkScheme,
  uploadModelAnswer,
  uploadQuestionPaper,
  deletePDF,
  getTotalMarks,
  deleteMarkScheme, // ✅ ADDED
  deleteQuestion, // ✅ ADDED
  deleteSubPart, // ✅ ADDED
} from '../mark-scheme/mark-scheme-controller.js';
import { uploadPDF } from '../../middlewares/multer.middleware.js';
import { multerErrorHandler } from '../../middlewares/multerErrorHadler.middleware.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── MARK SCHEME ROUTES ─────────────────────────────────────────

// ✅ Get mark scheme by exam ID
router.get('/exams/:examId/mark-scheme', verifyToken, getMarkSchemeByExam);

// ✅ Save mark scheme with PDF upload
router.post(
  '/exams/:examId/mark-scheme',
  verifyToken,
  uploadPDF.fields([
    { name: 'model_answer_pdf', maxCount: 1 },
    { name: 'question_paper_pdf', maxCount: 1 },
  ]),
  multerErrorHandler,
  saveMarkScheme,
);

// ✅ Delete entire mark scheme
router.delete('/exams/:examId/mark-scheme', verifyToken, deleteMarkScheme);

// ✅ Delete specific question
router.delete(
  '/exams/:examId/mark-scheme/question/:questionNum',
  verifyToken,
  deleteQuestion,
);

// ✅ Delete specific sub-part
router.delete(
  '/exams/:examId/mark-scheme/question/:questionNum/subpart/:subLabel',
  verifyToken,
  deleteSubPart,
);

// ✅ Upload only model answer PDF
router.post(
  '/exams/:examId/model-answer',
  verifyToken,
  uploadPDF.single('model_answer_pdf'),
  multerErrorHandler,
  uploadModelAnswer,
);

// ✅ Upload only question paper PDF
router.post(
  '/exams/:examId/question-paper',
  verifyToken,
  uploadPDF.single('question_paper_pdf'),
  multerErrorHandler,
  uploadQuestionPaper,
);

// ✅ Delete PDF (model_answer or question_paper)
router.delete('/exams/:examId/pdf/:type', verifyToken, deletePDF);

// ✅ Get total marks for exam
router.get('/exams/:examId/total-marks', verifyToken, getTotalMarks);

export default router;
