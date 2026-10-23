import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sseTracker,
  NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER,
  CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER,
} from '../../src/lib/sse-tracker';

describe('SSE Connection Tracker Unit Tests (sseTracker)', () => {
  // Track users created in each test to ensure complete cleanup in afterEach
  const activeNotificationUsers: string[] = [];
  const activeChatUsers: string[] = [];

  const getUniqueUserId = (prefix: string = 'user') => {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
  };

  afterEach(() => {
    // Drain all active test users to guarantee zero state leakage between tests
    for (const userId of activeNotificationUsers) {
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER + 2; i++) {
        sseTracker.removeNotificationConnection(userId);
      }
    }
    activeNotificationUsers.length = 0;

    for (const userId of activeChatUsers) {
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER + 2; i++) {
        sseTracker.removeChatConnection(userId);
      }
    }
    activeChatUsers.length = 0;
  });

  // =========================================================================
  // 1. Configuration Constants & Defaults
  // =========================================================================
  describe('Configuration Defaults', () => {
    it('verifies default maximum connection limits from environment or fallback', () => {
      // By default without env override, limits are 3 for notifications and 5 for conversations
      expect(NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER).toBe(3);
      expect(CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER).toBe(5);
    });
  });

  // =========================================================================
  // 2. Notification Connection Tracking & Limits
  // =========================================================================
  describe('Notification Connection Tracking', () => {
    it('registers connections up to the maximum limit of 3', () => {
      const userId = getUniqueUserId('notif');
      activeNotificationUsers.push(userId);

      // Connections 1, 2, and 3 should all be accepted
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
    });

    it('rejects connections beyond the maximum limit of 3 with false', () => {
      const userId = getUniqueUserId('notif-limit');
      activeNotificationUsers.push(userId);

      // Max out the 3 available slots
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      }

      // 4th connection attempt must be rejected
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);
      // Repeated rejection when still at capacity
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);
    });

    it('frees a connection slot upon disconnect and allows new connections', () => {
      const userId = getUniqueUserId('notif-slot-reuse');
      activeNotificationUsers.push(userId);

      // Max out the 3 slots
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        sseTracker.addNotificationConnection(userId);
      }
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);

      // Remove one connection (client closed a tab)
      sseTracker.removeNotificationConnection(userId);

      // A new connection should now be permitted
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);

      // Now back at limit, further connection should be rejected again
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Chat / Conversation Connection Tracking & Limits
  // =========================================================================
  describe('Chat Connection Tracking', () => {
    it('registers connections up to the maximum limit of 5', () => {
      const userId = getUniqueUserId('chat');
      activeChatUsers.push(userId);

      // Connections 1 through 5 should all be accepted
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addChatConnection(userId)).toBe(true);
      }
    });

    it('rejects chat connections beyond the maximum limit of 5 with false', () => {
      const userId = getUniqueUserId('chat-limit');
      activeChatUsers.push(userId);

      // Max out the 5 available slots
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addChatConnection(userId)).toBe(true);
      }

      // 6th connection attempt must be rejected
      expect(sseTracker.addChatConnection(userId)).toBe(false);
      expect(sseTracker.addChatConnection(userId)).toBe(false);
    });

    it('frees a chat connection slot upon disconnect and allows new connections', () => {
      const userId = getUniqueUserId('chat-slot-reuse');
      activeChatUsers.push(userId);

      // Max out the 5 slots
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        sseTracker.addChatConnection(userId);
      }
      expect(sseTracker.addChatConnection(userId)).toBe(false);

      // Close two tabs
      sseTracker.removeChatConnection(userId);
      sseTracker.removeChatConnection(userId);

      // Should now be able to open exactly two new connections
      expect(sseTracker.addChatConnection(userId)).toBe(true);
      expect(sseTracker.addChatConnection(userId)).toBe(true);

      // Capacity reached again
      expect(sseTracker.addChatConnection(userId)).toBe(false);
    });
  });

  // =========================================================================
  // 4. Multi-User Isolation
  // =========================================================================
  describe('Multi-User Isolation', () => {
    it('ensures connection limits for User A do not affect User B', () => {
      const userA = getUniqueUserId('userA');
      const userB = getUniqueUserId('userB');
      activeNotificationUsers.push(userA, userB);
      activeChatUsers.push(userA, userB);

      // User A exhausts notification connection limit (3)
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addNotificationConnection(userA)).toBe(true);
      }
      expect(sseTracker.addNotificationConnection(userA)).toBe(false);

      // User B should still be able to connect freely up to limit
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addNotificationConnection(userB)).toBe(true);
      }
      expect(sseTracker.addNotificationConnection(userB)).toBe(false);

      // Disconnecting User A does not affect User B
      sseTracker.removeNotificationConnection(userA);
      expect(sseTracker.addNotificationConnection(userA)).toBe(true); // User A has room
      expect(sseTracker.addNotificationConnection(userB)).toBe(false); // User B is still full
    });
  });

  // =========================================================================
  // 5. Channel Independence (Notification vs Chat)
  // =========================================================================
  describe('Channel Independence', () => {
    it('maintains independent quotas for notification and chat channels for the same user', () => {
      const userId = getUniqueUserId('user-dual-channel');
      activeNotificationUsers.push(userId);
      activeChatUsers.push(userId);

      // Max out notification connections (3)
      for (let i = 0; i < NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      }
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);

      // Chat channel for the same user is unaffected and can use all 5 slots
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addChatConnection(userId)).toBe(true);
      }
      expect(sseTracker.addChatConnection(userId)).toBe(false);

      // Removing a chat connection does not free a notification slot
      sseTracker.removeChatConnection(userId);
      expect(sseTracker.addNotificationConnection(userId)).toBe(false); // Still full
      expect(sseTracker.addChatConnection(userId)).toBe(true); // Chat has space
    });
  });

  // =========================================================================
  // 6. Complete Removal & Clean State Pruning
  // =========================================================================
  describe('State Cleanup & Pruning', () => {
    it('fully prunes tracking entry when connections drop to zero and allows fresh cycles', () => {
      const userId = getUniqueUserId('user-prune');
      activeNotificationUsers.push(userId);

      // Add 2 connections
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);

      // Remove both connections
      sseTracker.removeNotificationConnection(userId);
      sseTracker.removeNotificationConnection(userId);

      // Re-connecting should start clean and allow the full quota again
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);
    });

    it('fully prunes chat tracking entry when count drops to zero and allows full quota again', () => {
      const userId = getUniqueUserId('chat-prune');
      activeChatUsers.push(userId);

      // Add 3 chat connections
      expect(sseTracker.addChatConnection(userId)).toBe(true);
      expect(sseTracker.addChatConnection(userId)).toBe(true);
      expect(sseTracker.addChatConnection(userId)).toBe(true);

      // Remove all 3
      sseTracker.removeChatConnection(userId);
      sseTracker.removeChatConnection(userId);
      sseTracker.removeChatConnection(userId);

      // All 5 slots should now be available from scratch
      for (let i = 0; i < CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER; i++) {
        expect(sseTracker.addChatConnection(userId)).toBe(true);
      }
      expect(sseTracker.addChatConnection(userId)).toBe(false);
    });
  });

  // =========================================================================
  // 7. Safe Handling of Untracked and Excess Disconnects
  // =========================================================================
  describe('Safe Disconnect & Idempotency', () => {
    it('safely handles removeNotificationConnection for an untracked user without errors', () => {
      const unknownUserId = getUniqueUserId('unknown-notif');
      expect(() => {
        sseTracker.removeNotificationConnection(unknownUserId);
      }).not.toThrow();
    });

    it('safely handles removeChatConnection for an untracked user without errors', () => {
      const unknownUserId = getUniqueUserId('unknown-chat');
      expect(() => {
        sseTracker.removeChatConnection(unknownUserId);
      }).not.toThrow();
    });

    it('handles excess remove calls beyond zero without corrupting state or counts', () => {
      const userId = getUniqueUserId('excess-remove');
      activeNotificationUsers.push(userId);

      // Add 1 connection
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);

      // Remove 5 times (4 excess calls)
      for (let i = 0; i < 5; i++) {
        expect(() => {
          sseTracker.removeNotificationConnection(userId);
        }).not.toThrow();
      }

      // State should not have become negative; next addition starts clean at 1
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(true);
      expect(sseTracker.addNotificationConnection(userId)).toBe(false);
    });
  });
});
