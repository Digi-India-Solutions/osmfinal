// src/setting/settingRoutes.js
import { Router } from 'express';
import {
  getSettings,
  createSettings,
  updateSettings,
  deleteSettings,
  checkSettingsExist,
} from './settingController.js';
import { upload } from '../../middlewares/multer.middleware.js';
import { multerErrorHandler } from '../../middlewares/multerErrorHadler.middleware.js';

const router = Router();

// ─── SETTINGS ROUTES ──────────────────────────────────────────────────────

// GET /api/settings - Get settings
router.get('/settings', getSettings);

// POST /api/settings - Create settings with logo
router.post(
  '/settings',
  upload.single('logo'),
  multerErrorHandler,
  createSettings,
);

// PUT /api/settings - Update settings with logo
router.put(
  '/settings',
  upload.single('logo'),
  multerErrorHandler,
  updateSettings,
);

// PATCH /api/settings - Partial update (without logo)
router.patch('/settings', updateSettings);

// GET /api/settings/exists - Check if settings exist
router.get('/settings/exists', checkSettingsExist);

// DELETE /api/settings - Delete settings
router.delete('/settings', deleteSettings);

export default router;
