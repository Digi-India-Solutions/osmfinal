// src/routes/checker.routes.js

import { Router } from 'express';
import {
  saveDraft,
  submitMarks,
  getDraft,
  getSubmittedMarks,
  escalateSheet,
} from './checkerMarkingCont.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── CHECKER MARKING ROUTES ────────────────────────────────────

// Save draft
router.post('/sheet/:sheetId/draft', verifyToken, saveDraft);

// Submit marks
router.post('/sheet/:sheetId/submit', verifyToken, submitMarks);

// Get saved draft
router.get('/sheet/:sheetId/draft', verifyToken, getDraft);

// Get submitted marks
router.get('/sheet/:sheetId/submitted', verifyToken, getSubmittedMarks);

// Escalate sheet
router.post('/sheet/:sheetId/escalate', verifyToken, escalateSheet);

export default router;
