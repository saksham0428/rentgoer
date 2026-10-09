import { Router } from 'express';
import { 
  updateReview,
  deleteReview
} from '../controllers/review.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Review update/delete (tenant only)
router.put('/:id', authMiddleware, requireRole('TENANT'), updateReview);
router.delete('/:id', authMiddleware, requireRole('TENANT'), deleteReview);

export default router;
