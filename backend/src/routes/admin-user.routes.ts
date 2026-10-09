import { Router } from 'express';
import { listUsers, getUserDetail } from '../controllers/admin-user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN'));
router.get('/', listUsers);
router.get('/:id', getUserDetail);

export default router;
