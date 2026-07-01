// src/routes/work-queue.routes.js

import { Router } from 'express';
import {
  getSheets,
  getSheetById,
  updateSheetStatus,
  flagForRecheck,
  getRecheckRequests,
  getRecheckUsers,
  getRecheckRequestById,
  updateRecheckRequestStatus,
} from './workController.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── SHEET ROUTES ──────────────────────────────────────────────

// Get all sheets with filters
router.get('/sheets', verifyToken, getSheets);

// Get single sheet
router.get('/sheets/:id', verifyToken, getSheetById);

// Update sheet status
router.patch('/sheets/:id/status', verifyToken, updateSheetStatus);

// Flag sheet for recheck
router.post('/sheets/:id/flag-for-recheck', verifyToken, flagForRecheck);

// ─── RECHECK ROUTES ─────────────────────────────────────────────

// Get recheck requests
router.get('/recheck-requests', verifyToken, getRecheckRequests);

// Get recheck request by ID
router.get('/recheck-requests/:id', verifyToken, getRecheckRequestById);

// Update recheck request status
router.patch('/recheck-requests/:id', verifyToken, updateRecheckRequestStatus);

// Get recheck users
router.get('/users/recheckers', verifyToken, getRecheckUsers);

export default router;
