import express from 'express';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';
import {
  createItem,
  updateItem,
  deleteItem,
  getAllItems,
  getItemById,
  filterItems,
  getItemsWithVariantsForBOM, // ✅ Add this import
} from './items-controller.js';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// ✅ Specific routes (pehle, before dynamic /:id)
router.get('/bom-dropdown', getItemsWithVariantsForBOM); // BOM dropdown ke liye
router.get('/filter', filterItems);

// Generic CRUD routes
router.post('/', createItem);
router.get('/', getAllItems);
router.get('/:id', getItemById);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
