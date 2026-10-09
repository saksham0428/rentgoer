import { Router } from 'express';
import { 
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  streamNotifications
} from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getNotifications);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.put('/read-all', authMiddleware, markAllAsRead);
router.put('/:id/read', authMiddleware, markAsRead);
router.get('/realtime', authMiddleware, streamNotifications);

export default router;
