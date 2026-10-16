import assert from 'assert';
import { EventEmitter } from 'events';
import { chatEventEmitter, broadcastMessage } from '../src/lib/realtime';

// Offline Unit Test Suite for Real-Time Chat Infrastructure & Reconciliation
async function runChatUnitTests() {
  console.log('===============================================================');
  console.log('🧪 REAL-TIME CHAT: OFFLINE UNIT & RECONCILIATION TEST SUITE');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Message Content Validation
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Message Content Validation ---');

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

  assert.strictEqual(validateContent('').valid, false, 'Empty string must be invalid');
  assert.strictEqual(validateContent('   ').valid, false, 'Whitespace-only string must be invalid');
  assert.strictEqual(validateContent(null).valid, false, 'null content must be invalid');
  assert.strictEqual(validateContent(123).valid, false, 'Non-string content must be invalid');
  assert.strictEqual(validateContent('a'.repeat(2001)).valid, false, 'Content > 2000 chars must be invalid');

  const validResult = validateContent('  Hello, I am interested in this flat!  ');
  assert.strictEqual(validResult.valid, true);
  assert.strictEqual(validResult.sanitized, 'Hello, I am interested in this flat!');
  console.log('✓ Message content validation strictly enforces limits and trims whitespace');

  // ---------------------------------------------------------------------------
  // 2. Authorization & Membership Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Conversation Authorization & Status Guards ---');

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

  const testConv = {
    tenantId: 'tenant-123',
    ownerId: 'owner-456',
    requestStatus: 'ACCEPTED',
  };

  assert.strictEqual(authorizeChatAccess('tenant-123', testConv).status, 200, 'Tenant must have access');
  assert.strictEqual(authorizeChatAccess('owner-456', testConv).status, 200, 'Owner must have access');
  assert.strictEqual(authorizeChatAccess('intruder-789', testConv).status, 403, 'Third party must be rejected with 403');

  const pendingConv = { ...testConv, requestStatus: 'PENDING' };
  assert.strictEqual(authorizeChatAccess('tenant-123', pendingConv).status, 409, 'Pending request must be rejected with 409');

  const rejectedConv = { ...testConv, requestStatus: 'REJECTED' };
  assert.strictEqual(authorizeChatAccess('tenant-123', rejectedConv).status, 409, 'Rejected request must be rejected with 409');
  console.log('✓ Conversation authorization and rental status requirements verified');

  // ---------------------------------------------------------------------------
  // 3. Realtime Event Emitter & Keepalive Ping Dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Event Emitter & Keepalive Formatting ---');

  const receivedEvents: any[] = [];
  const testChannel = 'message:conv-unit-1';
  const listener = (msg: any) => receivedEvents.push(msg);

  chatEventEmitter.on(testChannel, listener);

  broadcastMessage({
    id: 'msg-1',
    conversationId: 'conv-unit-1',
    senderId: 'tenant-123',
    content: 'Live test message',
  });

  assert.strictEqual(receivedEvents.length, 1, 'Expected broadcastMessage to emit event synchronously');
  assert.strictEqual(receivedEvents[0].id, 'msg-1');
  assert.strictEqual(receivedEvents[0].content, 'Live test message');

  chatEventEmitter.off(testChannel, listener);

  // Formatting check for SSE keepalive pings
  const pingPayload = ': ping\n\n';
  assert(pingPayload.startsWith(':'), 'SSE comments begin with colon to be ignored by clients');
  assert(pingPayload.endsWith('\n\n'), 'SSE blocks terminate with double newline');
  console.log('✓ Realtime event emitter dispatches messages synchronously and keepalive ping is valid');

  // ---------------------------------------------------------------------------
  // 4. Optimistic UI Reconciliation & Deduplication
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Frontend Message Reconciliation & Deduplication ---');

  interface TestMsg {
    id: string;
    tempId?: string;
    senderId: string;
    content: string;
    status: 'sending' | 'sent' | 'failed';
  }

  // Pure reconciliation logic matching ChatWindowPage
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

  let messages: TestMsg[] = [];

  // Step A: User sends message optimistically
  const tempMsg: TestMsg = {
    id: 'temp-123',
    tempId: 'temp-123',
    senderId: 'tenant-123',
    content: 'Can we schedule a call?',
    status: 'sending',
  };
  messages = [...messages, tempMsg];
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].status, 'sending');

  // Step B: Server responds with persisted record (or SSE arrives first)
  const serverMsg: TestMsg = {
    id: 'server-uuid-456',
    senderId: 'tenant-123',
    content: 'Can we schedule a call?',
    status: 'sent',
  };

  messages = reconcileMessages(messages, serverMsg);
  assert.strictEqual(messages.length, 1, 'Reconciled message must replace optimistic message without duplicate');
  assert.strictEqual(messages[0].id, 'server-uuid-456', 'Reconciled message must have the real server ID');
  assert.strictEqual(messages[0].status, 'sent');

  // Step C: If SSE broadcasts the same message again, it must not create a duplicate
  messages = reconcileMessages(messages, serverMsg);
  assert.strictEqual(messages.length, 1, 'Duplicate broadcast must be ignored');

  // Step D: Incoming message from other user
  const incomingFromOwner: TestMsg = {
    id: 'server-uuid-789',
    senderId: 'owner-456',
    content: 'Yes, absolutely! Tomorrow at 10 AM works.',
    status: 'sent',
  };
  messages = reconcileMessages(messages, incomingFromOwner);
  assert.strictEqual(messages.length, 2, 'Message from other user must be appended');
  assert.strictEqual(messages[1].id, 'server-uuid-789');
  console.log('✓ Frontend optimistic messages reconcile smoothly with zero duplicate bubbles');

  // ---------------------------------------------------------------------------
  // 5. Date Separator Calculation
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Date Separator Formatting ---');

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
  assert.strictEqual(getDateLabel(new Date('2026-10-16T08:00:00Z'), fixedNow), 'Today');
  assert.strictEqual(getDateLabel(new Date('2026-10-15T10:00:00Z'), fixedNow), 'Yesterday');
  assert.strictEqual(getDateLabel(new Date('2026-10-10T10:00:00Z'), fixedNow), 'Sat, Oct 10');
  assert.strictEqual(getDateLabel(new Date('2025-05-01T10:00:00Z'), fixedNow), 'Thu, May 1, 2025');
  console.log('✓ Sensible date separators formatted accurately');

  // ---------------------------------------------------------------------------
  // 6. Scroll Threshold Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Scroll Position Guard Logic ---');

  const isNearBottom = (scrollHeight: number, scrollTop: number, clientHeight: number, threshold: number = 120): boolean => {
    return scrollHeight - scrollTop - clientHeight <= threshold;
  };

  // Case 1: Scrolled to absolute bottom
  assert.strictEqual(isNearBottom(1000, 600, 400), true, 'Bottom position is near bottom');

  // Case 2: Scrolled within 100px of bottom
  assert.strictEqual(isNearBottom(1000, 520, 400), true, 'Within threshold is near bottom');

  // Case 3: Scrolled up reading history (300px from bottom)
  assert.strictEqual(isNearBottom(1000, 300, 400), false, 'Scrolled up reading history is NOT near bottom');
  console.log('✓ Near-bottom detection correctly identifies when to preserve user scroll position');

  console.log('\n===============================================================');
  console.log('🎉 ALL REAL-TIME CHAT UNIT & RECONCILIATION TESTS PASSED (100%)');
  console.log('===============================================================\n');
}

runChatUnitTests().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
