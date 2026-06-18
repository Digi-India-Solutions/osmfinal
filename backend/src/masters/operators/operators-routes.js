import express from 'express';
import {
  createOperator,
  getAllOperators,
  updateOperator,
  deleteOperator,
  getOperatorsForDropdown, // ✅ Import new function
} from './operators-controller.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware to all operator routes
router.use(verifyToken);

router.post('/create', createOperator);
router.get('/', getAllOperators);
router.get('/dropdown', getOperatorsForDropdown); // ✅ New route for dropdown
router.put('/:id', updateOperator);
router.delete('/:id', deleteOperator);

export default router;
