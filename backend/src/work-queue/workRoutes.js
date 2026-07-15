// src/work-queue/workRoutes.js

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
  assignSheet,
  reassignRecheckRequests,
  getAvailableRecheckers,
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

// Assign sheet to checker
router.post('/sheets/:id/assign', verifyToken, assignSheet);

// ─── RECHECK ROUTES ─────────────────────────────────────────────

// Get recheck requests
router.get('/recheck-requests', verifyToken, getRecheckRequests);

// Get recheck request by ID
router.get('/recheck-requests/:id', verifyToken, getRecheckRequestById);

// Update recheck request status
router.patch('/recheck-requests/:id', verifyToken, updateRecheckRequestStatus);

// Get recheck users
router.get('/users/recheckers', verifyToken, getRecheckUsers);

// ─── REASSIGN ROUTES ────────────────────────────────────────────

// Reassign single sheet
router.post('/recheck/:sheetId/reassign', verifyToken, reassignRecheckRequests);

// Reassign multiple sheets (bulk)
router.post('/recheck/bulk/reassign', verifyToken, reassignRecheckRequests);

// Get available recheckers (excluding current)
router.get('/recheckers/available', verifyToken, getAvailableRecheckers);
router.get(
  '/recheckers/available/:excludeId',
  verifyToken,
  getAvailableRecheckers,
);

export default router;
