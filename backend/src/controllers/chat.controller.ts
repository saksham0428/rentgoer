import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { chatEventEmitter, broadcastMessage } from '../lib/realtime';
import { sseTracker } from '../lib/sse-tracker';
import { emitNotification } from '../lib/realtime-notifications';

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
        rentalRequest: {
          select: { id: true, status: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                readAt: null
              }
            }
          }
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


export const getConversationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversationId = req.params.id as string;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            locality: true,
            city: true,
            rent: true,
            images: {
              take: 1,
              select: { url: true }
            }
          }
        },
        tenant: {
          select: { id: true, name: true, email: true, phone: true }
        },
        owner: {
          select: { id: true, name: true, email: true, phone: true }
        },
        rentalRequest: {
          select: { id: true, status: true, message: true, createdAt: true }
        }
      }
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


export const getUnreadMessagesCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const count = await prisma.message.count({
      where: {
        conversation: {
          OR: [
            { tenantId: userId },
            { ownerId: userId }
          ]
        },
        senderId: { not: userId },
        readAt: null
      }
    });

    res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Error fetching unread messages count:', error);
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

    const after = req.query.after as string | undefined;
    const whereClause: any = { conversationId };
    if (after) {
      const parsedDate = new Date(after);
      if (!isNaN(parsedDate.getTime())) {
        whereClause.createdAt = { gt: parsedDate };
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    
    // Synchronize read status using the atomic transactional helper
    markConversationReadInternal(userId, conversationId).catch(err =>
      console.error('Error synchronizing read status in getMessages:', err)
    );

    messages.reverse();

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markConversationReadInternal = async (
  userId: string,
  conversationId: string
): Promise<{
  status: number;
  message?: string;
  data?: {
    conversationId: string;
    markedMessagesCount: number;
    markedNotificationsCount: number;
    unreadNotificationCount: number;
    unreadChatCount: number;
  };
}> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, tenantId: true, ownerId: true }
  });

  if (!conversation) {
    return { status: 404, message: 'Conversation not found' };
  }

  if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
    return { status: 403, message: 'Forbidden' };
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark only messages the current user has received and viewed as read
    const messagesResult = await tx.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null
      },
      data: {
        readAt: now
      }
    });

    // 2. Mark corresponding chat-message notifications for that recipient as read
    const notificationsResult = await tx.notification.updateMany({
      where: {
        userId,
        type: 'CHAT_MESSAGE',
        referenceId: conversationId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: now
      }
    });

    // 3. Count remaining unread notifications for this user
    const unreadNotificationCount = await tx.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    // 4. Count remaining unread chat messages for this user across all their conversations
    const unreadChatCount = await tx.message.count({
      where: {
        conversation: {
          OR: [
            { tenantId: userId },
            { ownerId: userId }
          ]
        },
        senderId: { not: userId },
        readAt: null
      }
    });

    return {
      conversationId,
      markedMessagesCount: messagesResult.count,
      markedNotificationsCount: notificationsResult.count,
      unreadNotificationCount,
      unreadChatCount
    };
  });

  // Real-time synchronization: emit event via notification SSE channel
  try {
    emitNotification(userId, {
      type: 'NOTIFICATION_READ_SYNC',
      action: 'CONVERSATION_READ',
      conversationId,
      unreadNotificationCount: result.unreadNotificationCount,
      unreadChatCount: result.unreadChatCount
    });
  } catch (emitErr) {
    console.error('Error emitting read synchronization notification:', emitErr);
  }

  return { status: 200, data: result };
};

export const markConversationAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const conversationId = req.params.id as string;
    const result = await markConversationReadInternal(userId, conversationId);

    if (result.status !== 200) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }

    res.status(200).json({ success: true, ...result.data });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
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

    // Broadcast via Realtime SSE event emitter
    broadcastMessage(message);

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
    emitNotification(recipientId, notification);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const { propertyId, rentalRequestId } = req.body;

    // 1. Pre-rental conversation flow by propertyId
    if (propertyId && typeof propertyId === 'string') {
      if (userRole !== 'TENANT') {
        res.status(403).json({ success: false, message: 'Only tenants can initiate pre-rental conversations' });
        return;
      }

      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, ownerId: true, isAvailable: true, title: true }
      });

      if (!property) {
        res.status(404).json({ success: false, message: 'Property not found' });
        return;
      }

      if (property.ownerId === userId) {
        res.status(400).json({ success: false, message: 'You cannot initiate a conversation for your own property' });
        return;
      }

      // Check if conversation already exists for this tenant and property
      const existingConv = await prisma.conversation.findUnique({
        where: {
          propertyId_tenantId: {
            propertyId: property.id,
            tenantId: userId
          }
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              locality: true,
              city: true,
              images: { take: 1, select: { url: true } }
            }
          },
          tenant: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true, email: true } },
          rentalRequest: { select: { id: true, status: true } }
        }
      });

      if (existingConv) {
        res.status(200).json({ success: true, data: existingConv });
        return;
      }

      if (!property.isAvailable) {
        res.status(400).json({ success: false, message: 'This property is currently rented and unavailable for new inquiries' });
        return;
      }

      try {
        const conversation = await prisma.conversation.create({
          data: {
            propertyId: property.id,
            tenantId: userId,
            ownerId: property.ownerId,
            rentalRequestId: null
          },
          include: {
            property: {
              select: {
                id: true,
                title: true,
                locality: true,
                city: true,
                images: { take: 1, select: { url: true } }
              }
            },
            tenant: { select: { id: true, name: true, email: true } },
            owner: { select: { id: true, name: true, email: true } },
            rentalRequest: { select: { id: true, status: true } }
          }
        });

        res.status(201).json({ success: true, data: conversation });
        return;
      } catch (err: any) {
        // Concurrency protection: if a concurrent request created it in parallel, return the created one
        if (err.code === 'P2002') {
          const parallelConv = await prisma.conversation.findUnique({
            where: {
              propertyId_tenantId: {
                propertyId: property.id,
                tenantId: userId
              }
            },
            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  locality: true,
                  city: true,
                  images: { take: 1, select: { url: true } }
                }
              },
              tenant: { select: { id: true, name: true, email: true } },
              owner: { select: { id: true, name: true, email: true } },
              rentalRequest: { select: { id: true, status: true } }
            }
          });
          if (parallelConv) {
            res.status(200).json({ success: true, data: parallelConv });
            return;
          }
        }
        throw err;
      }
    }

    // 2. Rental request flow
    if (rentalRequestId && typeof rentalRequestId === 'string') {
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

      if (rentalRequest.conversation) {
        res.status(200).json({ success: true, data: rentalRequest.conversation });
        return;
      }

      // Check if conversation already exists by [propertyId, tenantId]
      const existingByPair = await prisma.conversation.findUnique({
        where: {
          propertyId_tenantId: {
            propertyId: rentalRequest.propertyId,
            tenantId: rentalRequest.tenantId
          }
        }
      });

      if (existingByPair) {
        try {
          const linked = await prisma.conversation.update({
            where: { id: existingByPair.id },
            data: { rentalRequestId }
          });
          res.status(200).json({ success: true, data: linked });
          return;
        } catch (err: any) {
          if (err.code === 'P2002') {
            const parallelConv = await prisma.conversation.findFirst({
              where: {
                OR: [
                  { rentalRequestId },
                  {
                    propertyId: rentalRequest.propertyId,
                    tenantId: rentalRequest.tenantId
                  }
                ]
              }
            });
            if (parallelConv) {
              res.status(200).json({ success: true, data: parallelConv });
              return;
            }
          }
          throw err;
        }
      }

      try {
        const conversation = await prisma.conversation.create({
          data: {
            rentalRequestId,
            propertyId: rentalRequest.propertyId,
            tenantId: rentalRequest.tenantId,
            ownerId: rentalRequest.property.ownerId
          }
        });

        res.status(201).json({ success: true, data: conversation });
        return;
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Competing request created conversation in parallel: fetch and return existing conversation
          const parallelConv = await prisma.conversation.findFirst({
            where: {
              OR: [
                { rentalRequestId },
                {
                  propertyId: rentalRequest.propertyId,
                  tenantId: rentalRequest.tenantId
                }
              ]
            }
          });
          if (parallelConv) {
            // If the parallel conversation was created without rentalRequestId (e.g. pre-rental race), link it
            if (!parallelConv.rentalRequestId) {
              try {
                const linked = await prisma.conversation.update({
                  where: { id: parallelConv.id },
                  data: { rentalRequestId }
                });
                res.status(200).json({ success: true, data: linked });
                return;
              } catch (linkErr: any) {
                if (linkErr.code === 'P2002') {
                  const refreshed = await prisma.conversation.findUnique({
                    where: { id: parallelConv.id }
                  });
                  if (refreshed) {
                    res.status(200).json({ success: true, data: refreshed });
                    return;
                  }
                }
                throw linkErr;
              }
            }
            res.status(200).json({ success: true, data: parallelConv });
            return;
          }
        }
        throw err;
      }
    }

    res.status(400).json({ success: false, message: 'propertyId or rentalRequestId required' });
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
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Initial connection confirmation
    res.write(': connected\n\n');

    // Keepalive ping every 20 seconds to prevent proxy / Render connection timeouts
    const keepAliveInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);

    const eventName = `message:${conversationId}`;

    const onMessage = (message: any) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    chatEventEmitter.on(eventName, onMessage);

    req.on('close', () => {
      clearInterval(keepAliveInterval);
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
