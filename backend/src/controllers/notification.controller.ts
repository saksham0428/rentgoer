import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { notificationEventEmitter, emitNotification } from '../lib/realtime-notifications';
import { sseTracker } from '../lib/sse-tracker';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const count = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const notificationId = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification || notification.userId !== userId) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    if (notification.isRead) {
      const unreadNotificationCount = await prisma.notification.count({
        where: { userId, isRead: false }
      });
      res.status(200).json({ success: true, data: notification, unreadNotificationCount });
      return;
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: now }
      });

      // If this is a CHAT_MESSAGE notification and references a conversation,
      // mark received unread messages in that conversation as read too
      if (notification.type === 'CHAT_MESSAGE' && notification.referenceId) {
        await tx.message.updateMany({
          where: {
            conversationId: notification.referenceId,
            senderId: { not: userId },
            readAt: null
          },
          data: { readAt: now }
        });

        // Also mark any other unread notifications for this conversation as read
        await tx.notification.updateMany({
          where: {
            userId,
            type: 'CHAT_MESSAGE',
            referenceId: notification.referenceId,
            isRead: false
          },
          data: { isRead: true, readAt: now }
        });
      }

      const unreadNotificationCount = await tx.notification.count({
        where: { userId, isRead: false }
      });

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

      return { updated, unreadNotificationCount, unreadChatCount };
    });

    try {
      emitNotification(userId, {
        type: 'NOTIFICATION_READ_SYNC',
        action: 'NOTIFICATION_READ',
        notificationId,
        conversationId: notification.referenceId,
        unreadNotificationCount: result.unreadNotificationCount,
        unreadChatCount: result.unreadChatCount
      });
    } catch (emitErr) {
      console.error('Error emitting read synchronization notification:', emitErr);
    }

    res.status(200).json({
      success: true,
      data: result.updated,
      unreadNotificationCount: result.unreadNotificationCount,
      unreadChatCount: result.unreadChatCount
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: now }
      });

      // Synchronize all received chat messages across user's conversations
      await tx.message.updateMany({
        where: {
          conversation: {
            OR: [
              { tenantId: userId },
              { ownerId: userId }
            ]
          },
          senderId: { not: userId },
          readAt: null
        },
        data: { readAt: now }
      });
    });

    try {
      emitNotification(userId, {
        type: 'NOTIFICATION_READ_SYNC',
        action: 'ALL_READ',
        unreadNotificationCount: 0,
        unreadChatCount: 0
      });
    } catch (emitErr) {
      console.error('Error emitting read synchronization notification:', emitErr);
    }

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      unreadNotificationCount: 0,
      unreadChatCount: 0
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const streamNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    if (!sseTracker.addNotificationConnection(userId)) {
      res.status(429).json({ success: false, message: 'Too many active notification connections' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const eventName = `notification:${userId}`;

    const onNotification = (notification: any) => {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    };

    notificationEventEmitter.on(eventName, onNotification);

    req.on('close', () => {
      notificationEventEmitter.off(eventName, onNotification);
      sseTracker.removeNotificationConnection(userId);
    });

  } catch (error) {
    console.error('Error streaming notifications:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};
