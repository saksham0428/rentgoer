import { Router } from 'express';
import { listVerifications, getVerificationDetail, approveVerification, rejectVerification } from '../controllers/admin-verification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Apply ADMIN authorization to all routes in this router
router.use(authMiddleware, requireRole('ADMIN'));

router.get('/', listVerifications);
router.get('/:id', getVerificationDetail);
router.put('/:id/approve', approveVerification);
router.put('/:id/reject', rejectVerification);

export default router;
