import { Router } from 'express';
import {
  getVariants,
  createVariant,
  updateVariant,
} from './itemVariantController.js';
import { verifyToken } from '../../../../middlewares/verifyToken.middleware.js';

const router = Router();

router.get('/item/:id/variants', verifyToken, getVariants);
router.post('/item/:id/variants', verifyToken, createVariant);// itemVariantRoutes.js mein add karo
router.patch('/item/:id/variants/:variantId', verifyToken, updateVariant);

export default router;
