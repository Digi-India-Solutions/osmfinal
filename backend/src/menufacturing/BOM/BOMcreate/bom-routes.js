import { Router } from 'express';
import {
  createBom,
  getAllBoms,
  getBomById,
  updateBom,
  deleteBom,
  duplicateBom,
  linkToItemMaster,
  unlinkFromItemMaster,
} from './bom-controller.js';
import { verifyToken } from '../../../../middlewares/verifyToken.middleware.js';

const router = Router();

router.use(verifyToken);

router.post('/', createBom);
router.get('/', getAllBoms);
router.get('/:id', getBomById);
router.put('/:id', updateBom);
router.delete('/:id', deleteBom);
router.post('/:id/duplicate', duplicateBom);
router.post('/:id/link', linkToItemMaster);
router.post('/:id/unlink', unlinkFromItemMaster);

export default router;
