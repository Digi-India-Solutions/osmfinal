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
  getRecheckedSheetById,
} from './recheckController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

console.log('✅ Recheck routes initializing...');

// ─── ✅ ADMIN ROUTES ────────────────────────────────────────────
router.get('/admin/rechecked/:id', verifyToken, getRecheckedSheetById);
console.log('   ✅ GET /admin/rechecked/:id');

// ─── ✅ SPECIFIC ROUTES - PEHLE RAKHO (wildcard routes se pehle) ────
router.get('/my-requests', verifyToken, getMyRecheckRequests);
console.log('   ✅ GET /my-requests');

// ✅ SPECIFIC ROUTES - ye pehle aayenge
router.get('/my-requests/:id/mark', verifyToken, startRecheckMarking);
console.log('   ✅ GET /my-requests/:id/mark');

router.post('/my-requests/:id/marks', verifyToken, saveRecheckMarks);
console.log('   ✅ POST /my-requests/:id/marks');

router.post('/my-requests/:id/save-draft', verifyToken, saveRecheckDraft);
console.log('   ✅ POST /my-requests/:id/save-draft');

router.get('/my-requests/:id/draft', verifyToken, getRecheckDraft);
console.log('   ✅ GET /my-requests/:id/draft');

router.post('/my-requests/:id/complete', verifyToken, completeRecheck);
console.log('   ✅ POST /my-requests/:id/complete');

router.post('/my-requests/:id/escalate', verifyToken, escalateRecheckRequest);
console.log('   ✅ POST /my-requests/:id/escalate');

// ⚠️ WILDCARD ROUTE - SABSE BAAD MEIN (last mein)
router.get('/my-requests/:id', verifyToken, getRecheckRequestById);
console.log('   ✅ GET /my-requests/:id (wildcard - last)');

// ─── STATUS PATCH ROUTE ──────────────────────────────────────────
router.patch(
  '/my-requests/:id/status',
  verifyToken,
  updateRecheckRequestStatus,
);
console.log('   ✅ PATCH /my-requests/:id/status');

console.log('✅ All recheck routes registered successfully');

export default router;
