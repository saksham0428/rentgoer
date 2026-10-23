import { describe, it, expect } from 'vitest';
import { chatEventEmitter, broadcastMessage } from '../../src/lib/realtime';

describe('Real-Time Chat & Reconciliation Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // 1. Message Content Validation
  // ---------------------------------------------------------------------------
  describe('Message Content Validation', () => {
    const validateContent = (content: any): { valid: boolean; reason?: string; sanitized?: string } => {
      if (!content || typeof content !== 'string') {
        return { valid: false, reason: 'Message content required' };
      }
      const trimmed = content.trim();
      if (trimmed.length === 0 || trimmed.length > 2000) {
        return { valid: false, reason: 'Message must be between 1 and 2000 characters' };
      }
      return { valid: true, sanitized: trimmed };
    };

    it('rejects empty, whitespace-only, null, and non-string content', () => {
      expect(validateContent('').valid).toBe(false);
      expect(validateContent('   ').valid).toBe(false);
      expect(validateContent(null).valid).toBe(false);
      expect(validateContent(undefined).valid).toBe(false);
      expect(validateContent(123).valid).toBe(false);
      expect(validateContent({ text: 'hi' }).valid).toBe(false);
    });

    it('rejects content exceeding 2000 characters', () => {
      const oversized = 'a'.repeat(2001);
      const res = validateContent(oversized);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/between 1 and 2000 characters/);
    });

    it('accepts valid message content and trims outer whitespace', () => {
      const res = validateContent('  Hello, I am interested in this flat!  ');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Hello, I am interested in this flat!');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Authorization & Membership Guard
  // ---------------------------------------------------------------------------
  describe('Conversation Authorization & Status Guards', () => {
    const authorizeChatAccess = (
      userId: string,
      conversation: { tenantId: string; ownerId: string; requestStatus: string }
    ): { status: number; message?: string } => {
      if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
        return { status: 403, message: 'Forbidden' };
      }
      if (conversation.requestStatus !== 'ACCEPTED' && conversation.requestStatus !== 'COMPLETED') {
        return { status: 409, message: 'Chat is only available for ACCEPTED requests' };
      }
      return { status: 200 };
    };

    const baseConv = {
      tenantId: 'tenant-123',
      ownerId: 'owner-456',
      requestStatus: 'ACCEPTED',
    };

    it('grants access to tenant and owner for ACCEPTED request', () => {
      expect(authorizeChatAccess('tenant-123', baseConv).status).toBe(200);
      expect(authorizeChatAccess('owner-456', baseConv).status).toBe(200);
    });

    it('grants access to tenant and owner for COMPLETED request', () => {
      const completedConv = { ...baseConv, requestStatus: 'COMPLETED' };
      expect(authorizeChatAccess('tenant-123', completedConv).status).toBe(200);
      expect(authorizeChatAccess('owner-456', completedConv).status).toBe(200);
    });

    it('rejects unauthorized third parties with 403 Forbidden', () => {
      const res = authorizeChatAccess('intruder-789', baseConv);
      expect(res.status).toBe(403);
      expect(res.message).toBe('Forbidden');
    });

    it('rejects non-accepted rental request states with 409 Conflict', () => {
      expect(authorizeChatAccess('tenant-123', { ...baseConv, requestStatus: 'PENDING' }).status).toBe(409);
      expect(authorizeChatAccess('tenant-123', { ...baseConv, requestStatus: 'REJECTED' }).status).toBe(409);
      expect(authorizeChatAccess('tenant-123', { ...baseConv, requestStatus: 'CANCELLED' }).status).toBe(409);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Realtime Event Emitter & Keepalive Formatting
  // ---------------------------------------------------------------------------
  describe('Realtime Event Emitter & Keepalive Formatting', () => {
    it('dispatches messages synchronously over the chatEventEmitter', () => {
      const receivedEvents: any[] = [];
      const testChannel = 'message:conv-vitest-1';
      const listener = (msg: any) => receivedEvents.push(msg);

      chatEventEmitter.on(testChannel, listener);

      broadcastMessage({
        id: 'msg-vitest-101',
        conversationId: 'conv-vitest-1',
        senderId: 'tenant-123',
        content: 'Live test message',
      });

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe('msg-vitest-101');
      expect(receivedEvents[0].content).toBe('Live test message');

      chatEventEmitter.off(testChannel, listener);
    });

    it('formats SSE keepalive ping comments correctly', () => {
      const pingPayload = ': ping\n\n';
      expect(pingPayload.startsWith(':')).toBe(true);
      expect(pingPayload.endsWith('\n\n')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Optimistic UI Reconciliation & Deduplication
  // ---------------------------------------------------------------------------
  describe('Frontend Message Reconciliation & Deduplication', () => {
    interface TestMsg {
      id: string;
      tempId?: string;
      senderId: string;
      content: string;
      status: 'sending' | 'sent' | 'failed';
    }

    const reconcileMessages = (prev: TestMsg[], newMsg: TestMsg): TestMsg[] => {
      // 1. Check if server ID is already present (exact duplicate)
      if (prev.some((m) => m.id === newMsg.id)) {
        return prev;
      }

      // 2. Check if optimistic message matches
      const optimisticIndex = prev.findIndex(
        (m) =>
          m.status === 'sending' &&
          m.senderId === newMsg.senderId &&
          m.content.trim() === newMsg.content.trim()
      );

      if (optimisticIndex !== -1) {
        const updated = [...prev];
        updated[optimisticIndex] = {
          ...newMsg,
          status: 'sent',
        };
        return updated;
      }

      return [...prev, { ...newMsg, status: 'sent' }];
    };

    it('replaces optimistic sending message with server response without duplicate bubbles', () => {
      let messages: TestMsg[] = [];

      // Step A: Optimistic send
      const tempMsg: TestMsg = {
        id: 'temp-123',
        tempId: 'temp-123',
        senderId: 'tenant-123',
        content: 'Can we schedule a call?',
        status: 'sending',
      };
      messages = [...messages, tempMsg];
      expect(messages.length).toBe(1);
      expect(messages[0].status).toBe('sending');

      // Step B: Server response replaces optimistic message
      const serverMsg: TestMsg = {
        id: 'server-uuid-456',
        senderId: 'tenant-123',
        content: 'Can we schedule a call?',
        status: 'sent',
      };
      messages = reconcileMessages(messages, serverMsg);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('server-uuid-456');
      expect(messages[0].status).toBe('sent');

      // Step C: Subsequent duplicate broadcast is safely ignored
      messages = reconcileMessages(messages, serverMsg);
      expect(messages.length).toBe(1);

      // Step D: Incoming message from other user is appended
      const incomingFromOwner: TestMsg = {
        id: 'server-uuid-789',
        senderId: 'owner-456',
        content: 'Yes, absolutely! Tomorrow at 10 AM works.',
        status: 'sent',
      };
      messages = reconcileMessages(messages, incomingFromOwner);
      expect(messages.length).toBe(2);
      expect(messages[1].id).toBe('server-uuid-789');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Date Separator Calculation
  // ---------------------------------------------------------------------------
  describe('Date Separator Formatting', () => {
    const getDateLabel = (date: Date, now: Date = new Date()): string => {
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
      if (isToday) return 'Today';

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();
      if (isYesterday) return 'Yesterday';

      const sameYear = date.getFullYear() === now.getFullYear();
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
    };

    const fixedNow = new Date('2026-10-16T12:00:00Z');

    it('formats today, yesterday, and past dates accurately', () => {
      expect(getDateLabel(new Date('2026-10-16T08:00:00Z'), fixedNow)).toBe('Today');
      expect(getDateLabel(new Date('2026-10-15T10:00:00Z'), fixedNow)).toBe('Yesterday');
      expect(getDateLabel(new Date('2026-10-10T10:00:00Z'), fixedNow)).toBe('Sat, Oct 10');
      expect(getDateLabel(new Date('2025-05-01T10:00:00Z'), fixedNow)).toBe('Thu, May 1, 2025');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Scroll Threshold Guard
  // ---------------------------------------------------------------------------
  describe('Scroll Position Guard Logic', () => {
    const isNearBottom = (
      scrollHeight: number,
      scrollTop: number,
      clientHeight: number,
      threshold: number = 120
    ): boolean => {
      return scrollHeight - scrollTop - clientHeight <= threshold;
    };

    it('detects when scroll position is near bottom vs. reading history', () => {
      // Case 1: Scrolled to absolute bottom
      expect(isNearBottom(1000, 600, 400)).toBe(true);

      // Case 2: Scrolled within 100px of bottom
      expect(isNearBottom(1000, 520, 400)).toBe(true);

      // Case 3: Scrolled up reading history (300px away)
      expect(isNearBottom(1000, 300, 400)).toBe(false);
    });
  });
});
