import { Router } from 'express';
import { getMarkSchemeByExam, saveMarkScheme } from './mark-scheme-controller.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

router.get('/exams/:examId/mark-scheme', getMarkSchemeByExam);
router.put('/exams/:examId/mark-scheme',  saveMarkScheme);

export default router;