import { Router } from 'express';
import { getAdminStats } from '../controllers/admin-stats.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN'));
router.get('/', getAdminStats);

export default router;
