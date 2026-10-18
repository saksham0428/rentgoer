import { Router } from 'express';
import { 
  getConversations,
  getUnreadMessagesCount,
  getConversationById,
  getMessages,
  sendMessage,
  createConversation,
  streamMessages,
  markConversationAsRead
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getConversations);
router.post('/', authMiddleware, createConversation);
router.post('/pre-rental', authMiddleware, createConversation);
router.get('/unread-count', authMiddleware, getUnreadMessagesCount);
router.get('/:id', authMiddleware, getConversationById);
router.patch('/:id/read', authMiddleware, markConversationAsRead);
router.post('/:id/read', authMiddleware, markConversationAsRead);
router.get('/:id/messages', authMiddleware, getMessages);
router.post('/:id/messages', authMiddleware, sendMessage);
router.get('/:id/realtime', authMiddleware, streamMessages);

export default router;
