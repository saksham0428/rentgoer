import assert from 'assert';
import { Request, Response } from 'express';
import { prisma } from '../src/lib/prisma';
import { createConversation } from '../src/controllers/chat.controller';
import { acceptRequest } from '../src/controllers/rental-request.controller';

// Helper to create mock Express Request & Response objects
function createMockReqRes(options: {
  userId?: string;
  userRole?: string;
  body?: any;
  params?: any;
}) {
  const req: Partial<Request> = {
    user: options.userId ? { id: options.userId, role: options.userRole || 'TENANT' } as any : undefined,
    body: options.body || {},
    params: options.params || {},
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: Partial<Response> = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(data: any) {
      responseData = data;
      return this as Response;
    },
  };

  return {
    req: req as Request,
    res: res as Response,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

// Custom error matching Prisma's known request error structure
class MockPrismaError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'PrismaClientKnownRequestError';
  }
}

async function runControllerConcurrencyTests() {
  console.log('========================================================================');
  console.log('🧪 REAL CONTROLLER IMPLEMENTATION CONCURRENCY & ERROR TESTS');
  console.log('========================================================================\n');

  // Save original prisma methods
  const originalRentalRequestFindUnique = prisma.rentalRequest.findUnique;
  const originalConversationFindUnique = prisma.conversation.findUnique;
  const originalConversationFindFirst = prisma.conversation.findFirst;
  const originalConversationCreate = prisma.conversation.create;
  const originalConversationUpdate = prisma.conversation.update;
  const originalTransaction = prisma.$transaction;
  const originalNotificationCreate = prisma.notification.create;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: createConversation handles P2002 on rentalRequestId creation path
    // -------------------------------------------------------------------------
    console.log('--- 1. Real createConversation: P2002 handling on rentalRequestId path ---');
    {
      const existingConversation = {
        id: 'conv-parallel-100',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        rentalRequestId: 'req-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock prisma lookups
      (prisma.rentalRequest as any).findUnique = async () => ({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      });

      // No conversation found initially
      (prisma.conversation as any).findUnique = async () => null;

      // Simulate concurrent race: create throws P2002
      let createCallCount = 0;
      (prisma.conversation as any).create = async () => {
        createCallCount++;
        throw new MockPrismaError('Unique constraint failed on the fields: (propertyId, tenantId)', 'P2002');
      };

      // In catch block, findFirst recovers the parallel-created conversation
      (prisma.conversation as any).findFirst = async () => existingConversation;

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      assert.strictEqual(getStatus(), 200, 'Must return 200 OK after recovering from P2002');
      assert.strictEqual(getData().success, true);
      assert.strictEqual(getData().data.id, 'conv-parallel-100', 'Must return the existing conversation data');
      assert.strictEqual(createCallCount, 1, 'Tried to create once, then recovered');
      console.log('✓ Successfully recovered from P2002 in rentalRequestId branch, returning 200 with existing conversation');
    }

    // -------------------------------------------------------------------------
    // TEST 2: createConversation does NOT swallow unrelated errors in rentalRequestId path
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Real createConversation: Unrelated errors surfaced as 500 ---');
    {
      (prisma.rentalRequest as any).findUnique = async () => ({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      });

      (prisma.conversation as any).findUnique = async () => null;

      // Simulate unrelated database failure (e.g. connection error P1001 or syntax error)
      (prisma.conversation as any).create = async () => {
        throw new MockPrismaError('Can not reach database server at localhost:5432', 'P1001');
      };

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      assert.strictEqual(getStatus(), 500, 'Unrelated error must return 500 Internal server error');
      assert.strictEqual(getData().success, false);
      assert.strictEqual(getData().message, 'Internal server error');
      console.log('✓ Unrelated Prisma errors (non-P2002) are not swallowed and return 500');
    }

    // -------------------------------------------------------------------------
    // TEST 3: acceptRequest handles pre-rental race with retry & conversation preservation
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Real acceptRequest: Retry on P2002 & conversation/message preservation ---');
    {
      const preRentalConversation = {
        id: 'conv-pre-rental-555',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        rentalRequestId: null,
      };

      let attemptCount = 0;

      // Mock interactive transaction
      (prisma as any).$transaction = async (callback: any) => {
        attemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: async () => ({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'PENDING',
              property: { id: 'prop-1', ownerId: 'owner-1', title: 'Luxury Apt', isAvailable: true },
            }),
            updateMany: async () => ({ count: 1 }),
            findMany: async () => [],
          },
          property: {
            updateMany: async () => ({ count: 1 }),
          },
          conversation: {
            findFirst: async () => {
              if (attemptCount === 1) {
                // In attempt 1, pre-rental conversation is not yet committed
                return null;
              }
              // In attempt 2, pre-rental conversation was committed
              return preRentalConversation;
            },
            create: async () => {
              // Attempt 1 fails because pre-rental creation commits concurrently with P2002
              throw new MockPrismaError('Unique constraint failed on (propertyId, tenantId)', 'P2002');
            },
            update: async (args: any) => {
              // Attempt 2 succeeds: links existing conversation in-place
              preRentalConversation.rentalRequestId = args.data.rentalRequestId;
              return preRentalConversation;
            },
          },
        };

        return await callback(mockTx);
      };

      (prisma.notification as any).create = async () => ({ id: 'notif-1' });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      assert.strictEqual(getStatus(), 200, 'Must return 200 OK after retry');
      assert.strictEqual(getData().success, true);
      assert.strictEqual(attemptCount, 2, 'Transaction must have retried exactly once after P2002 collision');
      assert.strictEqual(preRentalConversation.id, 'conv-pre-rental-555', 'Existing conversation ID must be preserved');
      assert.strictEqual(preRentalConversation.rentalRequestId, 'req-1', 'Must link existing conversation to rental request');
      console.log('✓ Successfully retried transaction on P2002, preserved existing conversation ID, and linked request');
    }

    // -------------------------------------------------------------------------
    // TEST 4: acceptRequest rejects non-retryable domain errors immediately
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Real acceptRequest: Domain validation & non-retryable errors ---');
    {
      let txAttemptCount = 0;
      (prisma as any).$transaction = async (callback: any) => {
        txAttemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: async () => ({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'REJECTED', // Non-pending status
              property: { id: 'prop-1', ownerId: 'owner-1', isAvailable: true },
            }),
          },
        };
        return await callback(mockTx);
      };

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      assert.strictEqual(getStatus(), 409, 'Must return 409 Conflict for invalid status');
      assert.strictEqual(getData().message, 'Request is not PENDING');
      assert.strictEqual(txAttemptCount, 1, 'Domain error must not trigger retries');
      console.log('✓ Domain errors (CONFLICT_STATUS) immediately return 409 without retrying');
    }

    console.log('\n========================================================================');
    console.log('🎉 ALL 4 REAL CONTROLLER CONCURRENCY TESTS PASSED (100%)');
    console.log('========================================================================\n');
  } finally {
    // Restore original prisma methods
    (prisma.rentalRequest as any).findUnique = originalRentalRequestFindUnique;
    (prisma.conversation as any).findUnique = originalConversationFindUnique;
    (prisma.conversation as any).findFirst = originalConversationFindFirst;
    (prisma.conversation as any).create = originalConversationCreate;
    (prisma.conversation as any).update = originalConversationUpdate;
    (prisma as any).$transaction = originalTransaction;
    (prisma.notification as any).create = originalNotificationCreate;
  }
}

runControllerConcurrencyTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
