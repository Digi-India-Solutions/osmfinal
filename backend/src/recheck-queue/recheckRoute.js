// src/routes/recheck-queue.routes.js

import { Router } from 'express';
import {
  getMyRecheckRequests,
  getRecheckRequestById,
  updateRecheckRequestStatus,
  startRecheckMarking,
  saveRecheckMarks,
  completeRecheck,
} from './recheckController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── RECHECK QUEUE ROUTES ──────────────────────────────────────

// Get my recheck requests (assigned to current user)
router.get('/my-requests', verifyToken, getMyRecheckRequests);

// Get recheck request by ID
router.get('/requests/:id', verifyToken, getRecheckRequestById);

// Update recheck request status
router.patch('/requests/:id/status', verifyToken, updateRecheckRequestStatus);

// Start recheck marking (get sheet details)
router.get('/requests/:id/marking', verifyToken, startRecheckMarking);

// Save recheck marks
router.post('/requests/:id/marks', verifyToken, saveRecheckMarks);

// Complete recheck
router.post('/requests/:id/complete', verifyToken, completeRecheck);

export default router;
