import express from 'express';
import {
  createDowntimeCode,
  getAllDowntimeCodes,
  updateDowntimeCode,
  deleteDowntimeCode,
  getDowntimeCodesForDropdown, // ✅ Import new function
} from './downtimecode-controller.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware to all downtime code routes
router.use(verifyToken);

router.post('/create', createDowntimeCode);
router.get('/', getAllDowntimeCodes);
router.get('/dropdown', getDowntimeCodesForDropdown); // ✅ New route for dropdown
router.put('/:id', updateDowntimeCode);
router.delete('/:id', deleteDowntimeCode);

export default router;
