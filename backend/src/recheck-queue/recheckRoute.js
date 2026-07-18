// src/recheck-queue/recheckRoutes.js

import { Router } from 'express';
import {
  getMyRecheckRequests,
  getRecheckRequestById,
  updateRecheckRequestStatus,
  startRecheckMarking,
  saveRecheckMarks,
  completeRecheck,
  saveRecheckDraft,
  getRecheckDraft,
  escalateRecheckRequest,
  getRecheckedSheetById, // ✅ IMPORT ADD KARO
} from './recheckController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── RECHECKER ROUTES (with assign_to check) ──────────────────

router.get('/my-requests', verifyToken, getMyRecheckRequests);
router.get('/my-requests/:id', verifyToken, getRecheckRequestById);
router.patch(
  '/my-requests/:id/status',
  verifyToken,
  updateRecheckRequestStatus,
);
router.get('/my-requests/:id/mark', verifyToken, startRecheckMarking);
router.post('/my-requests/:id/save-draft', verifyToken, saveRecheckDraft);
router.get('/my-requests/:id/draft', verifyToken, getRecheckDraft);
router.post('/my-requests/:id/complete', verifyToken, completeRecheck);
router.post('/my-requests/:id/escalate', verifyToken, escalateRecheckRequest);

// ─── ADMIN ROUTES (without assign_to check) ────────────────────

// ✅ Admin view rechecked sheet by ID - IMPORTANT: Ye route pehle hona chahiye
router.get('/admin/rechecked/:id', verifyToken, getRecheckedSheetById);

export default router;
