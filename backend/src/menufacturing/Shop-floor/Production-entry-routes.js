import express from 'express';
import {
  createProductionEntry,
  getAllProductionEntries,
  getProductionEntryById,
  updateProductionEntry,
  approveProductionEntry,
  deleteProductionEntry,
} from './Production-entry-controller.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware
router.use(verifyToken);

// ✅ CRUD Routes
router.post('/create', createProductionEntry);
router.get('/', getAllProductionEntries);
router.get('/:id', getProductionEntryById);
router.put('/:id', updateProductionEntry);
router.patch('/:id/approve', approveProductionEntry); // ✅ Approve endpoint
router.delete('/:id', deleteProductionEntry);

export default router;
