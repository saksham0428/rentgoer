import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { chatEventEmitter } from '../lib/realtime';
import { sseTracker } from '../lib/sse-tracker';

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { tenantId: userId },
          { ownerId: userId }
        ]
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            locality: true,
            city: true,
            images: {
              take: 1,
              select: { url: true }
            }
          }
        },
        tenant: {
          select: { id: true, name: true, email: true }
        },
        owner: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversationId = req.params.id as string;
    let limit = 50;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    messages.reverse();

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversationId = req.params.id as string;
    let { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, message: 'Message content required' });
      return;
    }

    content = content.trim();
    if (content.length === 0 || content.length > 2000) {
      res.status(400).json({ success: false, message: 'Message must be between 1 and 2000 characters' });
      return;
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { rentalRequest: true }
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    if (conversation.rentalRequest.status !== 'ACCEPTED') {
      res.status(409).json({ success: false, message: 'Chat is only available for ACCEPTED requests' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content
      }
    });

    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Broadcast via Supabase Realtime
    import('../lib/realtime').then(m => m.broadcastMessage(message)).catch(console.error);

    // Notify other user
    const recipientId = conversation.tenantId === userId ? conversation.ownerId : conversation.tenantId;
    const notification = await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'CHAT_MESSAGE',
        title: 'New Message',
        message: 'You have a new message.',
        referenceId: conversation.id
      }
    });
    import('../lib/realtime-notifications').then(m => m.emitNotification(recipientId, notification)).catch(console.error);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const { rentalRequestId } = req.body;
    if (!rentalRequestId || typeof rentalRequestId !== 'string') {
      res.status(400).json({ success: false, message: 'rentalRequestId required' });
      return;
    }

    const rentalRequest = await prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: { property: true, conversation: true }
    });

    if (!rentalRequest) {
      res.status(404).json({ success: false, message: 'Rental request not found' });
      return;
    }

    if (rentalRequest.tenantId !== userId && rentalRequest.property.ownerId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    if (rentalRequest.status !== 'ACCEPTED') {
      res.status(409).json({ success: false, message: 'Chat is only available for ACCEPTED requests' });
      return;
    }

    if (rentalRequest.conversation) {
      res.status(200).json({ success: true, data: rentalRequest.conversation });
      return;
    }

    // Should not reach here normally due to transaction, but for idempotency:
    const conversation = await prisma.conversation.create({
      data: {
        rentalRequestId,
        propertyId: rentalRequest.propertyId,
        tenantId: rentalRequest.tenantId,
        ownerId: rentalRequest.property.ownerId
      }
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const streamMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversationId = req.params.id as string;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    if (!sseTracker.addChatConnection(userId)) {
      res.status(429).json({ success: false, message: 'Too many active chat connections' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const eventName = `message:${conversationId}`;

    const onMessage = (message: any) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    chatEventEmitter.on(eventName, onMessage);

    req.on('close', () => {
      chatEventEmitter.off(eventName, onMessage);
      sseTracker.removeChatConnection(userId);
    });

  } catch (error) {
    console.error('Error streaming messages:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};
