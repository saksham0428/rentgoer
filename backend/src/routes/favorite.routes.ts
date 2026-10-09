import { Router } from 'express';
import { getFavorites, getFavoritesIdList } from '../controllers/favorite.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Protected TENANT routes
router.get('/', authMiddleware, requireRole('TENANT'), getFavorites);
router.get('/ids', authMiddleware, requireRole('TENANT'), getFavoritesIdList);

export default router;
