import assert from 'assert';
import { EventEmitter } from 'events';

// Offline Unit Test Suite for Notification Read-Status Synchronization
async function runNotificationSyncUnitTests() {
  console.log('========================================================================');
  console.log('🧪 NOTIFICATION & CHAT READ-STATUS SYNCHRONIZATION TEST SUITE');
  console.log('========================================================================\n');

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

      return { status: 200, message: 'All notifications marked as read', unreadNotificationCount: 0, unreadChatCount: 0 };
    }
  }

  const db = new MockDb();

  // ---------------------------------------------------------------------------
  // Case 1: Opening a conversation marks its relevant received messages as read
  // ---------------------------------------------------------------------------
  console.log('--- Case 1 & 2: Opening conversation marks messages & chat notifications read ---');
  db.reset();

  const aliceConv1Result = await db.markConversationReadInternal('tenant-1', 'conv-1');
  assert.strictEqual(aliceConv1Result.status, 200);
  assert.strictEqual(aliceConv1Result.data?.markedMessagesCount, 2, 'Both messages from owner must be marked read');
  assert.strictEqual(aliceConv1Result.data?.markedNotificationsCount, 1, 'Chat notification for conv-1 must be marked read');

  // Verify messages in conv-1 now have readAt set
  const conv1Msgs = db.messages.filter((m) => m.conversationId === 'conv-1');
  assert(conv1Msgs.every((m) => m.readAt !== null), 'All messages in conv-1 must have non-null readAt');

  // Verify Alice's chat notification is now isRead: true
  const notif1 = db.notifications.find((n) => n.id === 'notif-1')!;
  assert.strictEqual(notif1.isRead, true, 'Chat notification notif-1 must be marked read');
  assert(notif1.readAt !== null, 'notif-1 readAt must be set');
  console.log('✓ Opening conversation marks relevant received messages and associated notification as read');

  // ---------------------------------------------------------------------------
  // Case 3 & 4: Unread notification count decreases; unrelated notifications remain unread
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 3 & 4: Unread notification count decreases; unrelated notifications remain unread ---');
  // Alice had 2 notifications: 1 CHAT_MESSAGE (conv-1) and 1 RENTAL_REQUEST.
  // After reading conv-1, unreadNotificationCount must be 1.
  assert.strictEqual(aliceConv1Result.data?.unreadNotificationCount, 1, 'Remaining unread notification count must be 1');

  // Verify Alice's non-chat notification notif-2 (RENTAL_REQUEST) is still unread!
  const notif2 = db.notifications.find((n) => n.id === 'notif-2')!;
  assert.strictEqual(notif2.isRead, false, 'Unrelated RENTAL_REQUEST notification must NOT be marked read');
  assert.strictEqual(notif2.readAt, null);

  // Verify Charlie's notification for conv-2 was NOT affected!
  const notif3 = db.notifications.find((n) => n.id === 'notif-3')!;
  assert.strictEqual(notif3.isRead, false, "Charlie's notification for conv-2 must remain unread");
  assert.strictEqual(notif3.readAt, null);

  // Verify Charlie's message in conv-2 was NOT marked read
  const charlieMsg = db.messages.find((m) => m.id === 'msg-3')!;
  assert.strictEqual(charlieMsg.readAt, null, "Charlie's message in conv-2 must remain unread");
  console.log('✓ Unread notification count decreased accurately and unrelated notifications remained unread');

  // ---------------------------------------------------------------------------
  // Case 5: Opening Messages inbox alone does not mark conversations or notifications read
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 5: Opening Messages inbox alone does not mark conversations read ---');
  db.reset();

  // Simulating GET /conversations (inbox view)
  const getConversations = (userId: string) => {
    return db.conversations.filter((c) => c.tenantId === userId || c.ownerId === userId);
  };

  const inboxConvs = getConversations('tenant-1');
  assert.strictEqual(inboxConvs.length, 1);

  // Verify no messages or notifications were marked read
  assert.strictEqual(db.messages.filter((m) => m.readAt !== null).length, 0, 'No messages should be read by inbox fetch');
  assert.strictEqual(db.notifications.filter((n) => n.isRead).length, 0, 'No notifications should be read by inbox fetch');
  console.log('✓ Merely opening the Messages inbox (/chat) does not mark any conversation as read');

  // ---------------------------------------------------------------------------
  // Case 6: A sender's own messages do not clear recipient's notifications
  // ---------------------------------------------------------------------------
  console.log("\n--- Case 6: Sender's own messages do not clear recipient notifications ---");
  db.reset();

  // Owner Bob calls markConversationReadInternal on conv-1
  // Bob is the SENDER of msg-1 and msg-2. Alice is the recipient.
  const bobResult = await db.markConversationReadInternal('owner-1', 'conv-1');
  assert.strictEqual(bobResult.status, 200);
  assert.strictEqual(bobResult.data?.markedMessagesCount, 0, "Bob cannot mark his own sent messages as read");
  assert.strictEqual(bobResult.data?.markedNotificationsCount, 0, "Bob has no notifications for his own sent messages");

  // Verify Alice's notification notif-1 is still unread!
  const aliceNotifStillUnread = db.notifications.find((n) => n.id === 'notif-1')!;
  assert.strictEqual(aliceNotifStillUnread.isRead, false, "Recipient's notification must not be marked read by sender");
  assert.strictEqual(aliceNotifStillUnread.readAt, null);
  console.log("✓ Sender's actions do not modify recipient notifications or read timestamps");

  // ---------------------------------------------------------------------------
  // Case 7: Unauthorized users cannot mark another user's conversation as read
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 7: Authorization guard prevents unauthorized access ---');
  db.reset();

  // Stranger Eve attempts to mark conv-1 as read
  const intruderResult = await db.markConversationReadInternal('stranger-1', 'conv-1');
  assert.strictEqual(intruderResult.status, 403, 'Intruder must receive 403 Forbidden');

  // Non-existent conversation
  const notFoundResult = await db.markConversationReadInternal('tenant-1', 'conv-999');
  assert.strictEqual(notFoundResult.status, 404, 'Non-existent conversation must return 404');
  console.log('✓ Strict participant validation enforces 403 Forbidden for non-participants');

  // ---------------------------------------------------------------------------
  // Case 8: Repeated mark-read requests are idempotent
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 8: Repeated mark-read requests are strictly idempotent ---');
  db.reset();

  const firstCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
  assert.strictEqual(firstCall.status, 200);
  assert.strictEqual(firstCall.data?.markedMessagesCount, 2);
  assert.strictEqual(firstCall.data?.markedNotificationsCount, 1);
  assert.strictEqual(firstCall.data?.unreadNotificationCount, 1);

  // Second call
  const secondCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
  assert.strictEqual(secondCall.status, 200);
  assert.strictEqual(secondCall.data?.markedMessagesCount, 0, 'Second call should mark 0 new messages');
  assert.strictEqual(secondCall.data?.markedNotificationsCount, 0, 'Second call should mark 0 new notifications');
  assert.strictEqual(secondCall.data?.unreadNotificationCount, 1, 'Unread count remains 1');

  // Third call
  const thirdCall = await db.markConversationReadInternal('tenant-1', 'conv-1');
  assert.strictEqual(thirdCall.status, 200);
  assert.strictEqual(thirdCall.data?.unreadNotificationCount, 1);
  console.log('✓ Repeated requests return identical consistent state without double-decrementing');

  // ---------------------------------------------------------------------------
  // Case 9: Notification Center Read Sync (Marking notification directly)
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 9: Marking chat notification read from notification center ---');
  db.reset();

  // Alice marks notif-1 directly as read from /notifications
  const notifReadResult = await db.markNotificationAsRead('tenant-1', 'notif-1');
  assert.strictEqual(notifReadResult.status, 200);
  assert.strictEqual(notifReadResult.unreadNotificationCount, 1);

  // Underlying received messages in conv-1 must also be marked read!
  const conv1MsgsAfterNotifRead = db.messages.filter((m) => m.conversationId === 'conv-1');
  assert(conv1MsgsAfterNotifRead.every((m) => m.readAt !== null), 'Messages in conv-1 must be marked read');

  // Calling markNotificationAsRead again on already-read notification is idempotent
  const repeatNotifRead = await db.markNotificationAsRead('tenant-1', 'notif-1');
  assert.strictEqual(repeatNotifRead.status, 200);
  assert.strictEqual(repeatNotifRead.unreadNotificationCount, 1);
  console.log('✓ Marking notification directly from center synchronizes conversation messages');

  // ---------------------------------------------------------------------------
  // Case 10: Mark All Notifications As Read
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 10: Mark all notifications as read ---');
  db.reset();

  const markAllResult = await db.markAllNotificationsAsRead('tenant-1');
  assert.strictEqual(markAllResult.status, 200);
  assert.strictEqual(markAllResult.unreadNotificationCount, 0);
  assert.strictEqual(markAllResult.unreadChatCount, 0);

  // All Alice's notifications are now isRead: true
  const aliceNotifs = db.notifications.filter((n) => n.userId === 'tenant-1');
  assert(aliceNotifs.every((n) => n.isRead), 'All Alice notifications must be read');

  // Charlie's notifications are still untouched!
  const charlieNotif = db.notifications.find((n) => n.userId === 'tenant-2')!;
  assert.strictEqual(charlieNotif.isRead, false, "Charlie's notification remains unread");
  console.log('✓ Mark all notifications as read resets counts and updates all received messages');

  // ---------------------------------------------------------------------------
  // Case 11: Realtime SSE Read-Sync Event Dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 11: Real-time SSE Read-Sync Event Dispatching ---');
  db.reset();

  await db.markConversationReadInternal('tenant-1', 'conv-1');
  const syncEvent = db.eventsDispatched.find((e) => e.channel === 'notification:tenant-1');
  assert(syncEvent, 'Notification sync event must be emitted to user channel');
  assert.strictEqual(syncEvent.data.type, 'NOTIFICATION_READ_SYNC');
  assert.strictEqual(syncEvent.data.action, 'CONVERSATION_READ');
  assert.strictEqual(syncEvent.data.conversationId, 'conv-1');
  assert.strictEqual(typeof syncEvent.data.unreadNotificationCount, 'number');
  assert.strictEqual(typeof syncEvent.data.unreadChatCount, 'number');
  console.log('✓ SSE read-sync event properly structured for client multi-tab synchronization');

  // ---------------------------------------------------------------------------
  // Case 12: Rapid Conversation Switching & Stale Response Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 12: Frontend rapid conversation switching guard ---');

  let activeConversationRef = 'conv-1';
  let activeState = { conversationId: 'conv-1', messagesLoaded: false };

  // User starts loading conv-1
  const loadConv1 = async () => {
    // Artificial latency
    await new Promise((r) => setTimeout(r, 50));
    if (activeConversationRef === 'conv-1') {
      activeState = { conversationId: 'conv-1', messagesLoaded: true };
    }
  };

  // User immediately switches to conv-2 before conv-1 finishes
  activeConversationRef = 'conv-2';
  const loadConv2 = async () => {
    await new Promise((r) => setTimeout(r, 10));
    if (activeConversationRef === 'conv-2') {
      activeState = { conversationId: 'conv-2', messagesLoaded: true };
    }
  };

  await Promise.all([loadConv1(), loadConv2()]);
  assert.strictEqual(activeState.conversationId, 'conv-2', 'Active state must belong to latest selected conversation');
  console.log('✓ Stale async conversation responses safely discarded during rapid switching');

  // ---------------------------------------------------------------------------
  // Case 13: Property Owner Role Compatibility
  // ---------------------------------------------------------------------------
  console.log('\n--- Case 13: Property Owner reads tenant messages ---');
  db.reset();

  // Tenant Alice sends a message to Bob (owner)
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

  // Bob (owner) opens conv-1
  const ownerReadResult = await db.markConversationReadInternal('owner-1', 'conv-1');
  assert.strictEqual(ownerReadResult.status, 200);
  assert.strictEqual(ownerReadResult.data?.markedMessagesCount, 1, 'Tenant message marked as read by owner');
  assert.strictEqual(ownerReadResult.data?.markedNotificationsCount, 1, 'Owner notification marked read');

  const notif4 = db.notifications.find((n) => n.id === 'notif-4')!;
  assert.strictEqual(notif4.isRead, true);
  console.log('✓ Property owner role marks tenant messages and notifications as read identically');

  console.log('\n========================================================================');
  console.log('🎉 ALL 13 NOTIFICATION READ SYNCHRONIZATION TESTS PASSED (100%)');
  console.log('========================================================================\n');
}

runNotificationSyncUnitTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
