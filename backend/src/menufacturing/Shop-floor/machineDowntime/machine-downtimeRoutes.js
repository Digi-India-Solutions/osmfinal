import express from 'express';
import {
  createDowntimeEntry,
  getAllDowntimeEntries,
  getDowntimeEntryById,
  updateDowntimeEntry,
  resolveDowntimeEntry,
  deleteDowntimeEntry,
} from './machine-downtimeController.js';
import { verifyToken } from '../../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware
router.use(verifyToken);

// ✅ CRUD Routes
router.post('/create', createDowntimeEntry);
router.get('/', getAllDowntimeEntries);
router.get('/:id', getDowntimeEntryById);
router.put('/:id', updateDowntimeEntry);
router.patch('/:id/resolve', resolveDowntimeEntry); // ✅ Resolve endpoint
router.delete('/:id', deleteDowntimeEntry);

export default router;
