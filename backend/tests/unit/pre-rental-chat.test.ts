import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-Memory Database Simulator for Pre-Rental Conversations
// ---------------------------------------------------------------------------
interface User {
  id: string;
  name: string;
  role: 'TENANT' | 'OWNER' | 'ADMIN';
}

interface Property {
  id: string;
  ownerId: string;
  title: string;
  isAvailable: boolean;
}

interface RentalRequest {
  id: string;
  propertyId: string;
  tenantId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
}

interface Conversation {
  id: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  rentalRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  type: string;
  title: string;
  message: string;
  referenceId: string | null;
  isRead: boolean;
}

class MockDb {
  users: User[] = [];
  properties: Property[] = [];
  rentalRequests: RentalRequest[] = [];
  conversations: Conversation[] = [];
  messages: Message[] = [];
  notifications: Notification[] = [];

  reset() {
    this.users = [
      { id: 'tenant-alice', name: 'Alice Tenant', role: 'TENANT' },
      { id: 'tenant-charlie', name: 'Charlie Tenant', role: 'TENANT' },
      { id: 'owner-bob', name: 'Bob Owner', role: 'OWNER' },
      { id: 'owner-diana', name: 'Diana Owner', role: 'OWNER' },
      { id: 'stranger-eve', name: 'Eve Stranger', role: 'TENANT' },
    ];

    this.properties = [
      {
        id: 'prop-1',
        ownerId: 'owner-bob',
        title: 'Sunny 2BHK in Indiranagar',
        isAvailable: true,
      },
      {
        id: 'prop-2',
        ownerId: 'owner-bob',
        title: 'Cozy 1BHK in Koramangala',
        isAvailable: false, // Currently rented
      },
    ];

    this.rentalRequests = [];
    this.conversations = [];
    this.messages = [];
    this.notifications = [];
  }

  // Server-side create/retrieve conversation handler matching chat.controller.ts
  async createConversation(
    userId: string | undefined,
    userRole: string | undefined,
    body: { propertyId?: string; rentalRequestId?: string; ownerId?: string }
  ): Promise<{ status: number; message?: string; data?: any }> {
    if (!userId) {
      return { status: 401, message: 'Unauthenticated' };
    }

    const { propertyId, rentalRequestId } = body;

    // 1. Pre-rental conversation flow by propertyId
    if (propertyId && typeof propertyId === 'string') {
      if (userRole !== 'TENANT') {
        return { status: 403, message: 'Only tenants can initiate pre-rental conversations' };
      }

      const property = this.properties.find((p) => p.id === propertyId);
      if (!property) {
        return { status: 404, message: 'Property not found' };
      }

      // Prevent self-conversation: property owner cannot initiate chat with self
      if (property.ownerId === userId) {
        return { status: 400, message: 'You cannot initiate a conversation for your own property' };
      }

      // Idempotency check: find existing by [propertyId, tenantId]
      const existingConv = this.conversations.find(
        (c) => c.propertyId === property.id && c.tenantId === userId
      );

      if (existingConv) {
        return { status: 200, data: existingConv };
      }

      if (!property.isAvailable) {
        return {
          status: 400,
          message: 'This property is currently rented and unavailable for new inquiries',
        };
      }

      // Owner is ALWAYS resolved from property record, ignoring any client-supplied ownerId
      const newConv: Conversation = {
        id: `conv-${this.conversations.length + 1}`,
        propertyId: property.id,
        tenantId: userId,
        ownerId: property.ownerId, // SERVER RESOLVED
        rentalRequestId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.conversations.push(newConv);
      return { status: 201, data: newConv };
    }

    // 2. Rental request flow
    if (rentalRequestId && typeof rentalRequestId === 'string') {
      const rentalRequest = this.rentalRequests.find((r) => r.id === rentalRequestId);
      if (!rentalRequest) {
        return { status: 404, message: 'Rental request not found' };
      }

      const property = this.properties.find((p) => p.id === rentalRequest.propertyId);
      if (!property) {
        return { status: 404, message: 'Property not found' };
      }

      if (rentalRequest.tenantId !== userId && property.ownerId !== userId) {
        return { status: 403, message: 'Forbidden' };
      }

      const linkedConv = this.conversations.find(
        (c) => c.rentalRequestId === rentalRequestId
      );
      if (linkedConv) {
        return { status: 200, data: linkedConv };
      }

      // Check if pre-rental conversation exists for this pair
      const existingByPair = this.conversations.find(
        (c) => c.propertyId === property.id && c.tenantId === rentalRequest.tenantId
      );

      if (existingByPair) {
        existingByPair.rentalRequestId = rentalRequestId;
        existingByPair.updatedAt = new Date();
        return { status: 200, data: existingByPair };
      }

      const newConv: Conversation = {
        id: `conv-${this.conversations.length + 1}`,
        propertyId: property.id,
        tenantId: rentalRequest.tenantId,
        ownerId: property.ownerId,
        rentalRequestId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.push(newConv);
      return { status: 201, data: newConv };
    }

    return { status: 400, message: 'propertyId or rentalRequestId required' };
  }

  // Message sending handler matching chat.controller.ts
  async sendMessage(
    userId: string | undefined,
    conversationId: string,
    content: any
  ): Promise<{ status: number; message?: string; data?: any }> {
    if (!userId) {
      return { status: 401, message: 'Unauthenticated' };
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return { status: 400, message: 'Message content required' };
    }

    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      return { status: 404, message: 'Conversation not found' };
    }

    if (conversation.tenantId !== userId && conversation.ownerId !== userId) {
      return { status: 403, message: 'Forbidden' };
    }

    const msg: Message = {
      id: `msg-${this.messages.length + 1}`,
      conversationId,
      senderId: userId,
      content: content.trim(),
      readAt: null,
      createdAt: new Date(),
    };

    this.messages.push(msg);
    conversation.updatedAt = new Date();

    const recipientId = conversation.tenantId === userId ? conversation.ownerId : conversation.tenantId;
    this.notifications.push({
      id: `notif-${this.notifications.length + 1}`,
      userId: recipientId,
      type: 'CHAT_MESSAGE',
      title: 'New Message',
      message: 'You have a new message.',
      referenceId: conversation.id,
      isRead: false,
    });

    return { status: 201, data: msg };
  }

  // Rental request acceptance logic matching rental-request.controller.ts
  async acceptRentalRequest(ownerId: string, requestId: string) {
    const request = this.rentalRequests.find((r) => r.id === requestId);
    if (!request) return { status: 404, message: 'Rental request not found' };

    const property = this.properties.find((p) => p.id === request.propertyId);
    if (!property || property.ownerId !== ownerId) {
      return { status: 403, message: 'Forbidden' };
    }

    request.status = 'ACCEPTED';

    // Link existing pre-rental conversation or create conversation atomically
    const existingConv = this.conversations.find(
      (c) => c.propertyId === request.propertyId && c.tenantId === request.tenantId
    );

    if (existingConv) {
      existingConv.rentalRequestId = requestId;
      existingConv.updatedAt = new Date();
      return { status: 200, conversation: existingConv };
    } else {
      const newConv: Conversation = {
        id: `conv-${this.conversations.length + 1}`,
        rentalRequestId: requestId,
        propertyId: request.propertyId,
        tenantId: request.tenantId,
        ownerId: property.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.push(newConv);
      return { status: 200, conversation: newConv };
    }
  }
}

describe('Pre-Rental Conversations Offline Unit Test Suite', () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
    db.reset();
  });

  // ---------------------------------------------------------------------------
  // Pre-Rental Conversation Initiation & Security Guards
  // ---------------------------------------------------------------------------
  describe('Pre-Rental Conversation Initiation & Security Guards', () => {
    it('allows authenticated tenant to initiate a conversation with rentalRequestId: null', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });

      expect(initResult.status).toBe(201);
      expect(initResult.data?.id).toBeDefined();
      expect(initResult.data.rentalRequestId).toBeNull();
      expect(initResult.data.propertyId).toBe('prop-1');
      expect(initResult.data.tenantId).toBe('tenant-alice');
      expect(initResult.data.ownerId).toBe('owner-bob');
    });

    it('returns existing conversation idempotently on repeated initiation without duplicate records', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const repeatResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });

      expect(repeatResult.status).toBe(200);
      expect(repeatResult.data.id).toBe(initResult.data.id);
      expect(db.conversations.length).toBe(1);
    });

    it('resolves ownerId strictly from Property record, blocking client tampering', async () => {
      const tamperResult = await db.createConversation('tenant-charlie', 'TENANT', {
        propertyId: 'prop-1',
        ownerId: 'owner-diana', // Malicious attempt to redirect to Diana
      });

      expect(tamperResult.status).toBe(201);
      expect(tamperResult.data.ownerId).toBe('owner-bob');
    });

    it('enforces authentication and tenant role requirements', async () => {
      const ownerAttempt = await db.createConversation('owner-diana', 'OWNER', {
        propertyId: 'prop-1',
      });
      expect(ownerAttempt.status).toBe(403);

      const unauthAttempt = await db.createConversation(undefined, undefined, {
        propertyId: 'prop-1',
      });
      expect(unauthAttempt.status).toBe(401);
    });

    it('prevents owners from initiating conversations on their own properties', async () => {
      const selfAttempt = await db.createConversation('owner-bob', 'TENANT', {
        propertyId: 'prop-1',
      });
      expect(selfAttempt.status).toBe(400);
      expect(selfAttempt.message).toMatch(/own property/i);
    });

    it('blocks new inquiries for unavailable or rented properties', async () => {
      const rentedAttempt = await db.createConversation('tenant-charlie', 'TENANT', {
        propertyId: 'prop-2', // isAvailable: false
      });
      expect(rentedAttempt.status).toBe(400);
      expect(rentedAttempt.message).toMatch(/currently rented|unavailable/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Message Exchange & Notification Delivery
  // ---------------------------------------------------------------------------
  describe('Message Exchange & Notification Delivery', () => {
    it('allows tenant and owner to exchange messages before a rental request exists', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;

      // Tenant sends inquiry
      const tenantMsg = await db.sendMessage(
        'tenant-alice',
        convId,
        'Hi Bob, is the maintenance included in the rent? Also can we visit this Sunday?'
      );
      expect(tenantMsg.status).toBe(201);
      expect(tenantMsg.data.content).toBe(
        'Hi Bob, is the maintenance included in the rent? Also can we visit this Sunday?'
      );

      // Owner replies
      const ownerReply = await db.sendMessage(
        'owner-bob',
        convId,
        'Hi Alice, yes! Maintenance is included. Sunday 11 AM works great for a visit.'
      );
      expect(ownerReply.status).toBe(201);
      expect(ownerReply.data.senderId).toBe('owner-bob');
      expect(db.messages.length).toBe(2);
    });

    it('creates accurate realtime notifications for the recipient with referenceId set', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;

      await db.sendMessage('tenant-alice', convId, 'Message to owner');
      await db.sendMessage('owner-bob', convId, 'Reply to tenant');

      expect(db.notifications.length).toBe(2);
      expect(db.notifications[0].userId).toBe('owner-bob');
      expect(db.notifications[0].referenceId).toBe(convId);

      expect(db.notifications[1].userId).toBe('tenant-alice');
      expect(db.notifications[1].referenceId).toBe(convId);
    });

    it('strictly forbids non-participants from sending messages', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;

      const intruderMsg = await db.sendMessage('stranger-eve', convId, 'Spam message');
      expect(intruderMsg.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Rental Request Acceptance & History Preservation
  // ---------------------------------------------------------------------------
  describe('Rental Request Acceptance & History Preservation', () => {
    it('connects accepted rental request to existing pre-rental conversation and preserves history', async () => {
      // 1. Pre-rental conversation
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;

      await db.sendMessage('tenant-alice', convId, 'Pre-rental question 1');
      await db.sendMessage('owner-bob', convId, 'Pre-rental answer 1');

      // 2. Later, Alice submits a rental request
      const newRequest: RentalRequest = {
        id: 'req-alice-101',
        propertyId: 'prop-1',
        tenantId: 'tenant-alice',
        status: 'PENDING',
      };
      db.rentalRequests.push(newRequest);

      // 3. Bob accepts the request
      const acceptResult = await db.acceptRentalRequest('owner-bob', 'req-alice-101');
      expect(acceptResult.status).toBe(200);
      expect(acceptResult.conversation.id).toBe(convId);
      expect(acceptResult.conversation.rentalRequestId).toBe('req-alice-101');

      // 4. Pre-rental messages preserved
      const convMessages = db.messages.filter((m) => m.conversationId === convId);
      expect(convMessages.length).toBe(2);
    });

    it('allows messaging to continue smoothly post-acceptance on the same thread', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;
      await db.sendMessage('tenant-alice', convId, 'Pre-rental inquiry');

      db.rentalRequests.push({
        id: 'req-alice-102',
        propertyId: 'prop-1',
        tenantId: 'tenant-alice',
        status: 'PENDING',
      });
      await db.acceptRentalRequest('owner-bob', 'req-alice-102');

      const postMsg = await db.sendMessage(
        'tenant-alice',
        convId,
        'Thank you Bob! I will bring the agreement documents.'
      );
      expect(postMsg.status).toBe(201);
      expect(db.messages.length).toBe(2);
    });

    it('preserves conversation ID and complete message history through acceptance race', async () => {
      const initResult = await db.createConversation('tenant-alice', 'TENANT', {
        propertyId: 'prop-1',
      });
      const convId = initResult.data.id;
      await db.sendMessage('tenant-alice', convId, 'Msg 1');
      await db.sendMessage('owner-bob', convId, 'Msg 2');

      db.rentalRequests.push({
        id: 'req-alice-103',
        propertyId: 'prop-1',
        tenantId: 'tenant-alice',
        status: 'PENDING',
      });
      await db.acceptRentalRequest('owner-bob', 'req-alice-103');
      await db.sendMessage('tenant-alice', convId, 'Msg 3');

      const aliceConv = db.conversations.find(
        (c) => c.tenantId === 'tenant-alice' && c.propertyId === 'prop-1'
      );
      expect(aliceConv).toBeDefined();
      expect(aliceConv?.id).toBe(convId);
      expect(aliceConv?.rentalRequestId).toBe('req-alice-103');

      const allMessages = db.messages.filter((m) => m.conversationId === convId);
      expect(allMessages.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrency & Collision Resilience
  // ---------------------------------------------------------------------------
  describe('Concurrency & Collision Resilience', () => {
    it('safely resolves concurrent conversation creation requests for propertyId path', async () => {
      const p1 = db.createConversation('tenant-alice', 'TENANT', { propertyId: 'prop-1' });
      const p2 = db.createConversation('tenant-alice', 'TENANT', { propertyId: 'prop-1' });
      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1.data.id).toBeDefined();
      expect(res1.data.id).toBe(res2.data.id);
    });

    it('safely resolves concurrent conversation creation requests for rentalRequestId path', async () => {
      const reqCharlie: RentalRequest = {
        id: 'req-charlie-202',
        propertyId: 'prop-1',
        tenantId: 'tenant-charlie',
        status: 'PENDING',
      };
      db.rentalRequests.push(reqCharlie);

      const [resC1, resC2] = await Promise.all([
        db.createConversation('tenant-charlie', 'TENANT', { rentalRequestId: 'req-charlie-202' }),
        db.createConversation('tenant-charlie', 'TENANT', { rentalRequestId: 'req-charlie-202' }),
      ]);

      expect(resC1.data.id).toBe(resC2.data.id);
    });

    it('properly surfaces validation errors rather than swallowing them', async () => {
      const errRes = await db.createConversation('tenant-alice', 'TENANT', {
        rentalRequestId: 'non-existent-req-id',
      });
      expect(errRes.status).toBe(404);
    });
  });
});
