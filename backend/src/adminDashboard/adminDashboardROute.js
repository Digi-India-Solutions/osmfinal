// src/routes/dashboard.routes.js

import { Router } from 'express';
import {
  getDashboardStats,
  getStatusChart,
  getRecentSheets,
  getCheckerStats,
  getRecheckStats,
} from './adminDashboard.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── DASHBOARD ROUTES ──────────────────────────────────────────

router.get('/stats', verifyToken, getDashboardStats);
router.get('/status-chart', verifyToken, getStatusChart);
router.get('/recent-sheets', verifyToken, getRecentSheets);
router.get('/checker-stats', verifyToken, getCheckerStats);
router.get('/recheck-stats', verifyToken, getRecheckStats);

export default router;
