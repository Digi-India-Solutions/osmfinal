import express from 'express';
import {
  createMachine,
  getAllMachines,
  updateMachine,
  deleteMachine,
  getMachinesForDropdown, // ✅ Import new function
} from './machines.controller.js';
import { verifyToken } from '../../../middlewares/verifyToken.middleware.js';

const router = express.Router();

// Apply authentication middleware to all machine routes
router.use(verifyToken);

router.post('/create', createMachine);
router.get('/', getAllMachines);
router.get('/dropdown', getMachinesForDropdown); // ✅ New route for dropdown
router.put('/:id', updateMachine);
router.delete('/:id', deleteMachine);

export default router;
