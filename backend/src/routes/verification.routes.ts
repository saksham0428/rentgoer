import { Router } from 'express';
import { createOwnerVerification, getMyVerificationRequests } from '../controllers/verification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.post('/owner', authMiddleware, requireRole('OWNER'), createOwnerVerification);
router.get('/me', authMiddleware, getMyVerificationRequests);

export default router;
