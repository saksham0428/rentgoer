import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock Prisma completely to guarantee zero database or network operations
vi.mock('../../src/lib/prisma', () => {
  return {
    prisma: {
      rentalRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      conversation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      property: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
        createManyAndReturn: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

import { prisma } from '../../src/lib/prisma';
import { createConversation } from '../../src/controllers/chat.controller';
import { acceptRequest } from '../../src/controllers/rental-request.controller';

// Helper to create mock Express Request & Response objects
function createMockReqRes(options: {
  userId?: string;
  userRole?: string;
  body?: any;
  params?: any;
  query?: any;
}) {
  const req: Partial<Request> = {
    user: options.userId ? ({ id: options.userId, role: options.userRole || 'TENANT' } as any) : undefined,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
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

describe('Controller Concurrency & Race-Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. createConversation Concurrency & P2002 Unique Constraint Handling
  // =========================================================================
  describe('createConversation Concurrency & P2002 Recovery', () => {
    it('handles P2002 on rentalRequestId creation path and recovers parallel conversation (Test 1)', async () => {
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
      vi.mocked(prisma.rentalRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      } as any);

      // No conversation found initially
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

      // Simulate concurrent race: create throws P2002
      let createCallCount = 0;
      vi.mocked(prisma.conversation.create).mockImplementation(async () => {
        createCallCount++;
        throw new MockPrismaError('Unique constraint failed on the fields: (propertyId, tenantId)', 'P2002');
      });

      // In catch block, findFirst recovers the parallel-created conversation
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue(existingConversation as any);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);
      expect(getData().data.id).toBe('conv-parallel-100');
      expect(createCallCount).toBe(1);
    });

    it('does NOT swallow unrelated errors in rentalRequestId path and returns 500 (Test 2)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(prisma.rentalRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      } as any);

      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

      // Simulate unrelated database failure (e.g. connection error P1001)
      vi.mocked(prisma.conversation.create).mockImplementation(async () => {
        throw new MockPrismaError('Can not reach database server at localhost:5432', 'P1001');
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(500);
      expect(getData().success).toBe(false);
      expect(getData().message).toBe('Internal server error');

      consoleErrorSpy.mockRestore();
    });

    it('handles P2002 on pre-rental propertyId path by recovering parallel conversation', async () => {
      const parallelConv = {
        id: 'conv-pre-rental-parallel',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        rentalRequestId: null,
      };

      vi.mocked(prisma.property.findUnique).mockResolvedValue({
        id: 'prop-1',
        ownerId: 'owner-1',
        isAvailable: true,
        title: 'Sunny Studio',
      } as any);

      // Initial check returns null (not found yet)
      vi.mocked(prisma.conversation.findUnique)
        .mockResolvedValueOnce(null) // first check before create
        .mockResolvedValueOnce(parallelConv as any); // second check in P2002 catch handler

      // Create throws P2002 because concurrent tenant request won the race
      vi.mocked(prisma.conversation.create).mockRejectedValue(
        new MockPrismaError('Unique constraint failed on (propertyId, tenantId)', 'P2002')
      );

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { propertyId: 'prop-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);
      expect(getData().data.id).toBe('conv-pre-rental-parallel');
    });

    it('links unlinked pre-rental conversation when parallel creation occurred without rentalRequestId', async () => {
      const parallelPreRentalConv = {
        id: 'conv-pre-rental-unlinked',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        rentalRequestId: null,
      };

      const linkedConv = {
        ...parallelPreRentalConv,
        rentalRequestId: 'req-1',
      };

      vi.mocked(prisma.rentalRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      } as any);

      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

      // Create fails with P2002
      vi.mocked(prisma.conversation.create).mockRejectedValue(
        new MockPrismaError('Unique constraint failed on (propertyId, tenantId)', 'P2002')
      );

      // findFirst returns the pre-rental conversation that lacks rentalRequestId
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue(parallelPreRentalConv as any);

      // Updating it links the rentalRequestId
      vi.mocked(prisma.conversation.update).mockResolvedValue(linkedConv as any);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);
      expect(getData().data.rentalRequestId).toBe('req-1');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-pre-rental-unlinked' },
        data: { rentalRequestId: 'req-1' },
      });
    });

    it('returns 401 when request is unauthenticated', async () => {
      const { req, res, getStatus, getData } = createMockReqRes({
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(401);
      expect(getData().message).toBe('Unauthenticated');
    });

    it('returns 403 when user is neither tenant nor owner on rental request', async () => {
      vi.mocked(prisma.rentalRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        conversation: null,
        property: { id: 'prop-1', ownerId: 'owner-1' },
      } as any);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'intruder-999',
        userRole: 'TENANT',
        body: { rentalRequestId: 'req-1' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(403);
      expect(getData().message).toBe('Forbidden');
    });

    it('returns 404 when rental request does not exist', async () => {
      vi.mocked(prisma.rentalRequest.findUnique).mockResolvedValue(null);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'tenant-1',
        userRole: 'TENANT',
        body: { rentalRequestId: 'non-existent' },
      });

      await createConversation(req, res);

      expect(getStatus()).toBe(404);
      expect(getData().message).toBe('Rental request not found');
    });
  });

  // =========================================================================
  // 2. acceptRequest Transaction Retries & Atomicity Tests
  // =========================================================================
  describe('acceptRequest Transaction Retries & Concurrency Protection', () => {
    it('handles pre-rental race with retry & conversation preservation (Test 3)', async () => {
      const preRentalConversation = {
        id: 'conv-pre-rental-555',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        rentalRequestId: null as string | null,
      };

      let attemptCount = 0;

      // Mock interactive transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        attemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'PENDING',
              property: { id: 'prop-1', ownerId: 'owner-1', title: 'Luxury Apt', isAvailable: true },
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          property: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          conversation: {
            findFirst: vi.fn().mockImplementation(async () => {
              if (attemptCount === 1) {
                // In attempt 1, pre-rental conversation is not yet committed
                return null;
              }
              // In attempt 2, pre-rental conversation was committed
              return preRentalConversation;
            }),
            create: vi.fn().mockImplementation(async () => {
              // Attempt 1 fails because pre-rental creation commits concurrently with P2002
              throw new MockPrismaError('Unique constraint failed on (propertyId, tenantId)', 'P2002');
            }),
            update: vi.fn().mockImplementation(async (args: any) => {
              // Attempt 2 succeeds: links existing conversation in-place
              preRentalConversation.rentalRequestId = args.data.rentalRequestId;
              return preRentalConversation;
            }),
          },
        };

        return await callback(mockTx);
      });

      vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notif-1' } as any);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);
      expect(attemptCount).toBe(2);
      expect(preRentalConversation.id).toBe('conv-pre-rental-555');
      expect(preRentalConversation.rentalRequestId).toBe('req-1');
    });

    it('rejects non-retryable domain error CONFLICT_STATUS immediately with 409 (Test 4)', async () => {
      let txAttemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        txAttemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'REJECTED', // Non-pending status
              property: { id: 'prop-1', ownerId: 'owner-1', isAvailable: true },
            }),
          },
        };
        return await callback(mockTx);
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(409);
      expect(getData().message).toBe('Request is not PENDING');
      expect(txAttemptCount).toBe(1);
    });

    it('retries transaction on P2034 write conflict or deadlock message', async () => {
      let attemptCount = 0;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new MockPrismaError('Transaction failed due to a write conflict or a deadlock. Please retry.', 'P2034');
        }

        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'PENDING',
              property: { id: 'prop-1', ownerId: 'owner-1', title: 'Studio', isAvailable: true },
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          property: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          conversation: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'conv-new-1' }),
            update: vi.fn(),
          },
        };

        return await callback(mockTx);
      });

      vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notif-1' } as any);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('rejects immediately with 409 when property is no longer available (CONFLICT_AVAILABILITY)', async () => {
      let txAttemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        txAttemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'PENDING',
              property: { id: 'prop-1', ownerId: 'owner-1', isAvailable: false }, // Property already rented
            }),
          },
        };
        return await callback(mockTx);
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(409);
      expect(getData().message).toBe('Property is already unavailable');
      expect(txAttemptCount).toBe(1);
    });

    it('rejects with 403 Forbidden when caller is not property owner', async () => {
      let txAttemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        txAttemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              propertyId: 'prop-1',
              tenantId: 'tenant-1',
              status: 'PENDING',
              property: { id: 'prop-1', ownerId: 'different-owner-99', isAvailable: true },
            }),
          },
        };
        return await callback(mockTx);
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(403);
      expect(getData().message).toBe('Forbidden');
      expect(txAttemptCount).toBe(1);
    });

    it('rejects with 404 when request is not found', async () => {
      let txAttemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        txAttemptCount++;
        const mockTx = {
          rentalRequest: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return await callback(mockTx);
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(404);
      expect(getData().message).toBe('Request not found');
      expect(txAttemptCount).toBe(1);
    });

    it('returns 409 after exhausting max retries on persistent concurrency conflicts (P2034 / deadlock)', async () => {
      let attemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async () => {
        attemptCount++;
        throw new MockPrismaError('Persistent deadlock detected', 'P2034');
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(409);
      expect(getData().message).toBe('Conflict: request was accepted by another concurrent operation. Please refresh.');
      expect(attemptCount).toBe(3); // maxRetries is 3
    });

    it('returns 500 on unexpected non-retryable database failure in acceptRequest', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let attemptCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async () => {
        attemptCount++;
        throw new Error('Database disk failure or unhandled exception');
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(500);
      expect(getData().message).toBe('Internal server error');
      expect(attemptCount).toBe(1); // non-retryable error fails immediately without looping

      consoleErrorSpy.mockRestore();
    });
  });
});
