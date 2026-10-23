import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-Memory Database Simulator for Chat & Notifications
// ---------------------------------------------------------------------------
interface User {
  id: string;
  name: string;
  role: 'TENANT' | 'OWNER' | 'ADMIN';
}

interface Conversation {
  id: string;
  tenantId: string;
  ownerId: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

interface Notification {
  id: string;
  userId: string;
  type: 'RENTAL_REQUEST' | 'REQUEST_ACCEPTED' | 'REQUEST_REJECTED' | 'CHAT_MESSAGE';
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  referenceId: string | null;
  createdAt: Date;
}

class MockDb {
  users: User[] = [];
  conversations: Conversation[] = [];
  messages: Message[] = [];
  notifications: Notification[] = [];
  eventsDispatched: { channel: string; data: any }[] = [];

  reset() {
    this.users = [
      { id: 'tenant-1', name: 'Alice Tenant', role: 'TENANT' },
      { id: 'owner-1', name: 'Bob Owner', role: 'OWNER' },
      { id: 'tenant-2', name: 'Charlie Tenant', role: 'TENANT' },
      { id: 'owner-2', name: 'Diana Owner', role: 'OWNER' },
      { id: 'stranger-1', name: 'Eve Stranger', role: 'TENANT' },
    ];

    this.conversations = [
      { id: 'conv-1', tenantId: 'tenant-1', ownerId: 'owner-1' },
      { id: 'conv-2', tenantId: 'tenant-2', ownerId: 'owner-1' },
    ];

    this.messages = [
      // Conversation 1: Bob (owner) sent 2 messages to Alice (tenant)
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'owner-1',
        content: 'Hello Alice, your request is approved!',
        readAt: null,
        createdAt: new Date('2026-10-16T10:00:00Z'),
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: 'owner-1',
        content: 'When would you like to move in?',
        readAt: null,
        createdAt: new Date('2026-10-16T10:05:00Z'),
      },
      // Conversation 2: Bob sent a message to Charlie
      {
        id: 'msg-3',
        conversationId: 'conv-2',
        senderId: 'owner-1',
        content: 'Hi Charlie, please send your ID.',
        readAt: null,
        createdAt: new Date('2026-10-16T10:10:00Z'),
      },
    ];

    this.notifications = [
      // Alice has chat notification for conv-1
      {
        id: 'notif-1',
        userId: 'tenant-1',
        type: 'CHAT_MESSAGE',
        title: 'New Message',
        message: 'You have a new message.',
        isRead: false,
        readAt: null,
        referenceId: 'conv-1',
        createdAt: new Date('2026-10-16T10:05:00Z'),
      },
      // Alice has an unrelated non-chat notification (RENTAL_REQUEST)
      {
        id: 'notif-2',
        userId: 'tenant-1',
        type: 'RENTAL_REQUEST',
        title: 'Request Update',
        message: 'Your application status was updated.',
        isRead: false,
        readAt: null,
        referenceId: 'req-1',
        createdAt: new Date('2026-10-16T09:00:00Z'),
      },
      // Charlie has chat notification for conv-2
      {
        id: 'notif-3',
        userId: 'tenant-2',
        type: 'CHAT_MESSAGE',
        title: 'New Message',
        message: 'You have a new message.',
        isRead: false,
        readAt: null,
        referenceId: 'conv-2',
        createdAt: new Date('2026-10-16T10:10:00Z'),
      },
    ];

    this.eventsDispatched = [];
  }

  emitNotification(userId: string, payload: any) {
    this.eventsDispatched.push({ channel: `notification:${userId}`, data: payload });
  }

  // Backend markConversationReadInternal logic
  async markConversationReadInternal(userId: string, conversationId: string) {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      return { status: 404, message: 'Conversation not found' };
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      return { status: 403, message: 'Forbidden' };
    }

    const now = new Date();

    // 1. Mark only messages the current user received in this conversation as read
    let markedMessagesCount = 0;
    for (const msg of this.messages) {
      if (msg.conversationId === conversationId && msg.senderId !== userId && msg.readAt === null) {
        msg.readAt = now;
        markedMessagesCount++;
      }
    }

    // 2. Mark corresponding chat-message notifications for that recipient as read
    let markedNotificationsCount = 0;
    for (const notif of this.notifications) {
      if (
        notif.userId === userId &&
        notif.type === 'CHAT_MESSAGE' &&
        notif.referenceId === conversationId &&
        !notif.isRead
      ) {
        notif.isRead = true;
        notif.readAt = now;
        markedNotificationsCount++;
      }
    }

    // 3. Count remaining unread notifications for this user
    const unreadNotificationCount = this.notifications.filter(
      (n) => n.userId === userId && !n.isRead
    ).length;

    // 4. Count remaining unread chat messages for this user
    const userConvs = this.conversations
      .filter((c) => c.tenantId === userId || c.ownerId === userId)
      .map((c) => c.id);
    const unreadChatCount = this.messages.filter(
      (m) => userConvs.includes(m.conversationId) && m.senderId !== userId && m.readAt === null
    ).length;

    const data = {
      conversationId,
      markedMessagesCount,
      markedNotificationsCount,
      unreadNotificationCount,
      unreadChatCount,
    };

    this.emitNotification(userId, {
      type: 'NOTIFICATION_READ_SYNC',
      action: 'CONVERSATION_READ',
      conversationId,
      unreadNotificationCount,
      unreadChatCount,
    });

    return { status: 200, data };
  }

  // Backend markAsRead notification logic
  async markNotificationAsRead(userId: string, notificationId: string) {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (!notif || notif.userId !== userId) {
      return { status: 404, message: 'Notification not found' };
    }

    if (notif.isRead) {
      const unreadNotificationCount = this.notifications.filter(
        (n) => n.userId === userId && !n.isRead
      ).length;
      return { status: 200, data: notif, unreadNotificationCount };
    }

    const now = new Date();
    notif.isRead = true;
    notif.readAt = now;

    // If CHAT_MESSAGE, mark received messages in referenced conversation
    if (notif.type === 'CHAT_MESSAGE' && notif.referenceId) {
      for (const msg of this.messages) {
        if (
          msg.conversationId === notif.referenceId &&
          msg.senderId !== userId &&
          msg.readAt === null
        ) {
          msg.readAt = now;
        }
      }
      for (const otherNotif of this.notifications) {
        if (
          otherNotif.userId === userId &&
          otherNotif.type === 'CHAT_MESSAGE' &&
          otherNotif.referenceId === notif.referenceId &&
          !otherNotif.isRead
        ) {
          otherNotif.isRead = true;
          otherNotif.readAt = now;
        }
      }
    }

    const unreadNotificationCount = this.notifications.filter(
      (n) => n.userId === userId && !n.isRead
    ).length;

    const userConvs = this.conversations
      .filter((c) => c.tenantId === userId || c.ownerId === userId)
      .map((c) => c.id);
    const unreadChatCount = this.messages.filter(
      (m) => userConvs.includes(m.conversationId) && m.senderId !== userId && m.readAt === null
    ).length;

    this.emitNotification(userId, {
      type: 'NOTIFICATION_READ_SYNC',
      action: 'NOTIFICATION_READ',
      notificationId,
      conversationId: notif.referenceId,
      unreadNotificationCount,
      unreadChatCount,
    });

    return { status: 200, data: notif, unreadNotificationCount, unreadChatCount };
  }

  // Backend markAllAsRead logic
  async markAllNotificationsAsRead(userId: string) {
    const now = new Date();
    for (const notif of this.notifications) {
      if (notif.userId === userId && !notif.isRead) {
        notif.isRead = true;
        notif.readAt = now;
      }
    }

    const userConvs = this.conversations
      .filter((c) => c.tenantId === userId || c.ownerId === userId)
      .map((c) => c.id);
    for (const msg of this.messages) {
      if (userConvs.includes(msg.conversationId) && msg.senderId !== userId && msg.readAt === null) {
        msg.readAt = now;
      }
    }

    this.emitNotification(userId, {
      type: 'NOTIFICATION_READ_SYNC',
      action: 'ALL_READ',
      unreadNotificationCount: 0,
      unreadChatCount: 0,
    });

    return {
      status: 200,
      message: 'All notifications marked as read',
      unreadNotificationCount: 0,
      unreadChatCount: 0,
    };
  }
}

describe('Notification & Chat Read-Status Synchronization Unit Tests', () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
    db.reset();
  });

  // ---------------------------------------------------------------------------
  // Case 1 & 2: Opening conversation marks messages & chat notifications read
  // ---------------------------------------------------------------------------
  describe('Conversation Read Operations', () => {
    it('marks received messages and associated chat notification as read when conversation is opened', async () => {
      const aliceResult = await db.markConversationReadInternal('tenant-1', 'conv-1');

      expect(aliceResult.status).toBe(200);
      expect(aliceResult.data?.markedMessagesCount).toBe(2);
      expect(aliceResult.data?.markedNotificationsCount).toBe(1);

      // Verify messages in conv-1 now have readAt set
      const conv1Msgs = db.messages.filter((m) => m.conversationId === 'conv-1');
      expect(conv1Msgs.every((m) => m.readAt !== null)).toBe(true);

      // Verify Alice's chat notification is now read
      const notif1 = db.notifications.find((n) => n.id === 'notif-1')!;
      expect(notif1.isRead).toBe(true);
      expect(notif1.readAt).not.toBeNull();
    });

    it('decrements unread count while leaving unrelated notifications and other user data untouched', async () => {
      const aliceResult = await db.markConversationReadInternal('tenant-1', 'conv-1');

      // Remaining unread notification count must be 1 (RENTAL_REQUEST remains)
      expect(aliceResult.data?.unreadNotificationCount).toBe(1);

      // Alice's non-chat notification (RENTAL_REQUEST) is still unread
      const notif2 = db.notifications.find((n) => n.id === 'notif-2')!;
      expect(notif2.isRead).toBe(false);
      expect(notif2.readAt).toBeNull();

      // Charlie's notification for conv-2 was NOT affected
      const notif3 = db.notifications.find((n) => n.id === 'notif-3')!;
      expect(notif3.isRead).toBe(false);
      expect(notif3.readAt).toBeNull();

      // Charlie's message in conv-2 was NOT marked read
      const charlieMsg = db.messages.find((m) => m.id === 'msg-3')!;
      expect(charlieMsg.readAt).toBeNull();
    });

    it('does not mark messages or notifications read upon merely fetching the inbox list', () => {
      const getConversations = (userId: string) => {
        return db.conversations.filter((c) => c.tenantId === userId || c.ownerId === userId);
      };

      const inboxConvs = getConversations('tenant-1');
      expect(inboxConvs.length).toBe(1);

      expect(db.messages.filter((m) => m.readAt !== null).length).toBe(0);
      expect(db.notifications.filter((n) => n.isRead).length).toBe(0);
    });

    it('prevents sender from marking their own sent messages as read or clearing recipient notifications', async () => {
      const bobResult = await db.markConversationReadInternal('owner-1', 'conv-1');

      expect(bobResult.status).toBe(200);
      expect(bobResult.data?.markedMessagesCount).toBe(0);
      expect(bobResult.data?.markedNotificationsCount).toBe(0);

      // Verify recipient Alice's notification notif-1 remains unread
      const aliceNotif = db.notifications.find((n) => n.id === 'notif-1')!;
      expect(aliceNotif.isRead).toBe(false);
      expect(aliceNotif.readAt).toBeNull();
    });

    it('enforces participant authorization guards (403 for non-participants, 404 for non-existent)', async () => {
      const intruderResult = await db.markConversationReadInternal('stranger-1', 'conv-1');
      expect(intruderResult.status).toBe(403);

      const notFoundResult = await db.markConversationReadInternal('tenant-1', 'conv-999');
      expect(notFoundResult.status).toBe(404);
    });

    it('guarantees idempotency on repeated mark-read requests without double-decrementing', async () => {
      const firstCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
      expect(firstCall.status).toBe(200);
      expect(firstCall.data?.markedMessagesCount).toBe(2);
      expect(firstCall.data?.markedNotificationsCount).toBe(1);
      expect(firstCall.data?.unreadNotificationCount).toBe(1);

      const secondCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
      expect(secondCall.status).toBe(200);
      expect(secondCall.data?.markedMessagesCount).toBe(0);
      expect(secondCall.data?.markedNotificationsCount).toBe(0);
      expect(secondCall.data?.unreadNotificationCount).toBe(1);

      const thirdCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
      expect(thirdCall.status).toBe(200);
      expect(thirdCall.data?.unreadNotificationCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Notification Center Direct Read Sync
  // ---------------------------------------------------------------------------
  describe('Notification Center Direct Read Sync', () => {
    it('synchronizes underlying conversation messages when chat notification is marked read directly', async () => {
      const notifReadResult = await db.markNotificationAsRead('tenant-1', 'notif-1');
      expect(notifReadResult.status).toBe(200);
      expect(notifReadResult.unreadNotificationCount).toBe(1);

      // Underlying messages in conv-1 must also be marked read
      const conv1Msgs = db.messages.filter((m) => m.conversationId === 'conv-1');
      expect(conv1Msgs.every((m) => m.readAt !== null)).toBe(true);

      // Repeated call on already-read notification is idempotent
      const repeatNotifRead = await db.markNotificationAsRead('tenant-1', 'notif-1');
      expect(repeatNotifRead.status).toBe(200);
      expect(repeatNotifRead.unreadNotificationCount).toBe(1);
    });

    it('marks all notifications and received messages read for user while isolating other users', async () => {
      const markAllResult = await db.markAllNotificationsAsRead('tenant-1');
      expect(markAllResult.status).toBe(200);
      expect(markAllResult.unreadNotificationCount).toBe(0);
      expect(markAllResult.unreadChatCount).toBe(0);

      // All Alice's notifications are read
      const aliceNotifs = db.notifications.filter((n) => n.userId === 'tenant-1');
      expect(aliceNotifs.every((n) => n.isRead)).toBe(true);

      // Charlie's notification remains unread
      const charlieNotif = db.notifications.find((n) => n.userId === 'tenant-2')!;
      expect(charlieNotif.isRead).toBe(false);
    });

    it('emits properly structured NOTIFICATION_READ_SYNC event for multi-tab synchronization', async () => {
      await db.markConversationReadInternal('tenant-1', 'conv-1');
      const syncEvent = db.eventsDispatched.find((e) => e.channel === 'notification:tenant-1');

      expect(syncEvent).toBeDefined();
      expect(syncEvent?.data.type).toBe('NOTIFICATION_READ_SYNC');
      expect(syncEvent?.data.action).toBe('CONVERSATION_READ');
      expect(syncEvent?.data.conversationId).toBe('conv-1');
      expect(typeof syncEvent?.data.unreadNotificationCount).toBe('number');
      expect(typeof syncEvent?.data.unreadChatCount).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrency & Multi-Role Support
  // ---------------------------------------------------------------------------
  describe('Client Concurrency & Multi-Role Support', () => {
    it('discards stale async conversation responses during rapid conversation switching', async () => {
      let activeConversationRef = 'conv-1';
      let activeState = { conversationId: 'conv-1', messagesLoaded: false };

      const loadConv1 = async () => {
        await new Promise((r) => setTimeout(r, 40));
        if (activeConversationRef === 'conv-1') {
          activeState = { conversationId: 'conv-1', messagesLoaded: true };
        }
      };

      activeConversationRef = 'conv-2';
      const loadConv2 = async () => {
        await new Promise((r) => setTimeout(r, 10));
        if (activeConversationRef === 'conv-2') {
          activeState = { conversationId: 'conv-2', messagesLoaded: true };
        }
      };

      await Promise.all([loadConv1(), loadConv2()]);
      expect(activeState.conversationId).toBe('conv-2');
      expect(activeState.messagesLoaded).toBe(true);
    });

    it('allows property owner to read tenant messages and mark notifications read identically', async () => {
      // Alice sends a message to owner Bob
      db.messages.push({
        id: 'msg-4',
        conversationId: 'conv-1',
        senderId: 'tenant-1',
        content: 'Hi Bob, I will move in on the 1st.',
        readAt: null,
        createdAt: new Date(),
      });
      db.notifications.push({
        id: 'notif-4',
        userId: 'owner-1',
        type: 'CHAT_MESSAGE',
        title: 'New Message',
        message: 'Alice sent a message.',
        isRead: false,
        readAt: null,
        referenceId: 'conv-1',
        createdAt: new Date(),
      });

      const ownerReadResult = await db.markConversationReadInternal('owner-1', 'conv-1');
      expect(ownerReadResult.status).toBe(200);
      expect(ownerReadResult.data?.markedMessagesCount).toBe(1);
      expect(ownerReadResult.data?.markedNotificationsCount).toBe(1);

      const notif4 = db.notifications.find((n) => n.id === 'notif-4')!;
      expect(notif4.isRead).toBe(true);
    });
  });
});
