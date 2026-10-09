import { Router } from 'express';
import { listProperties, getPropertyDetail } from '../controllers/admin-property.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN'));
router.get('/', listProperties);
router.get('/:id', getPropertyDetail);

export default router;
