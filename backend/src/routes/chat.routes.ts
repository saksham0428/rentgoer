import { Router } from 'express';
import { 
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  streamMessages
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getConversations);
router.post('/', authMiddleware, createConversation);
router.get('/:id/messages', authMiddleware, getMessages);
router.post('/:id/messages', authMiddleware, sendMessage);
router.get('/:id/realtime', authMiddleware, streamMessages);

export default router;
