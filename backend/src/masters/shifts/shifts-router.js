import express from 'express';
import {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
  getShiftsForDropdown, // ✅ Import karein
} from './shifts-controller.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware to all shift routes
router.use(verifyToken);

router.post('/create', createShift);
router.get('/', getAllShifts);
router.get('/dropdown', getShiftsForDropdown); // ✅ Naya route
router.put('/:id', updateShift);
router.delete('/:id', deleteShift);

export default router;
