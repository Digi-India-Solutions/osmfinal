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
  getCheckedSheetById, // ✅ Add this
  getCheckedSheets, // ✅ Add this
  getEscalatedSheets, // ✅ Add this
  getCompletedSheetsCount,
  downloadCompletedSheetsBatch,
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

// ─── CHECKED SHEETS ROUTES ────────────────────────────────────

// ✅ Get all checked sheets
router.get('/checked-sheets', verifyToken, getCheckedSheets);

// ✅ Get completed sheets count (checked + rechecked)
router.get('/completed-sheets/count', verifyToken, getCompletedSheetsCount);

// ✅ Download batch of completed sheets as zip
router.get('/completed-sheets/download-batch', verifyToken, downloadCompletedSheetsBatch);

// ✅ Get checked sheet by ID
router.get('/checked-sheets/:id', verifyToken, getCheckedSheetById);

// ─── ESCALATED SHEETS ROUTES ──────────────────────────────────

// ✅ Get escalated sheets
router.get('/escalated-sheets', verifyToken, getEscalatedSheets);

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
