import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock Prisma completely to guarantee zero database or network operations
vi.mock('../../src/lib/prisma', () => {
  return {
    prisma: {
      rentalRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
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
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        createManyAndReturn: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

import { prisma } from '../../src/lib/prisma';
import { rejectRequest, acceptRequest } from '../../src/controllers/rental-request.controller';
import { getUnreadCount, streamNotifications } from '../../src/controllers/notification.controller';
import { notificationEventEmitter } from '../../src/lib/realtime-notifications';

// Helper to create mock Express Request & Response objects
function createMockReqRes(options: {
  userId?: string;
  userRole?: string;
  body?: any;
  params?: any;
  query?: any;
}) {
  const req: Partial<Request> = {
    user: options.userId ? ({ id: options.userId, role: options.userRole || 'OWNER' } as any) : undefined,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    on: vi.fn(),
  };

  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};
  const writtenChunks: string[] = [];

  const res: Partial<Response> = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(data: any) {
      responseData = data;
      return this as Response;
    },
    setHeader(name: string, value: any) {
      headers[name] = String(value);
      return this as Response;
    },
    flushHeaders() {
      return this as Response;
    },
    write(chunk: any) {
      writtenChunks.push(String(chunk));
      return true;
    },
    end() {
      return this as Response;
    },
  };

  return {
    req: req as Request,
    res: res as Response,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers,
    getWrittenChunks: () => writtenChunks,
  };
}

describe('Rental Request Rejection & Notification Suite (Phase 3)', () => {
  // In-memory data store for stateful simulation
  let properties: Record<string, any>;
  let rentalRequests: Record<string, any>;
  let notifications: any[];

  beforeEach(() => {
    vi.clearAllMocks();

    properties = {
      'prop-1': {
        id: 'prop-1',
        ownerId: 'owner-1',
        title: 'Sunny Seaside 2BHK',
        isAvailable: true,
      },
      'prop-2': {
        id: 'prop-2',
        ownerId: 'owner-2',
        title: 'Downtown Studio',
        isAvailable: true,
      },
    };

    rentalRequests = {
      'req-pending-1': {
        id: 'req-pending-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        message: 'Looking to rent for 12 months',
        status: 'PENDING',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        updatedAt: new Date('2026-11-01T10:00:00Z'),
      },
      'req-pending-2': {
        id: 'req-pending-2',
        propertyId: 'prop-1',
        tenantId: 'tenant-2',
        message: 'Family with one child looking to rent',
        status: 'PENDING',
        createdAt: new Date('2026-11-01T11:00:00Z'),
        updatedAt: new Date('2026-11-01T11:00:00Z'),
      },
      'req-accepted-1': {
        id: 'req-accepted-1',
        propertyId: 'prop-2',
        tenantId: 'tenant-1',
        message: 'Ready to move in',
        status: 'ACCEPTED',
        createdAt: new Date('2026-11-01T08:00:00Z'),
        updatedAt: new Date('2026-11-01T09:00:00Z'),
      },
      'req-rejected-1': {
        id: 'req-rejected-1',
        propertyId: 'prop-2',
        tenantId: 'tenant-2',
        message: 'Can pay deposit immediately',
        status: 'REJECTED',
        createdAt: new Date('2026-11-01T08:30:00Z'),
        updatedAt: new Date('2026-11-01T09:30:00Z'),
      },
      'req-cancelled-1': {
        id: 'req-cancelled-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-3',
        message: 'Cancelled request',
        status: 'CANCELLED',
        createdAt: new Date('2026-11-01T07:00:00Z'),
        updatedAt: new Date('2026-11-01T07:30:00Z'),
      },
    };

    notifications = [];

    // Setup interactive transaction mock mirroring Prisma
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        rentalRequest: {
          findUnique: vi.fn().mockImplementation(async ({ where, include }: any) => {
            const req = rentalRequests[where.id];
            if (!req) return null;
            if (include?.property) {
              return { ...req, property: properties[req.propertyId] };
            }
            return { ...req };
          }),
          update: vi.fn().mockImplementation(async ({ where, data }: any) => {
            const req = rentalRequests[where.id];
            if (!req) throw new Error('NOT_FOUND');
            req.status = data.status;
            req.updatedAt = new Date();
            return { ...req };
          }),
          updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
            let count = 0;
            for (const r of Object.values(rentalRequests)) {
              let match = true;
              if (where.id && typeof where.id === 'string' && r.id !== where.id) match = false;
              if (where.id?.not && r.id === where.id.not) match = false;
              if (where.propertyId && r.propertyId !== where.propertyId) match = false;
              if (where.status && r.status !== where.status) match = false;
              if (match) {
                r.status = data.status;
                count++;
              }
            }
            return { count };
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return Object.values(rentalRequests).filter((r: any) => {
              if (where.propertyId && r.propertyId !== where.propertyId) return false;
              if (where.id?.not && r.id === where.id.not) return false;
              if (where.status && r.status !== where.status) return false;
              return true;
            });
          }),
        },
        property: {
          update: vi.fn().mockImplementation(async ({ where, data }: any) => {
            const prop = properties[where.id];
            if (prop && data.isAvailable !== undefined) {
              prop.isAvailable = data.isAvailable;
            }
            return { ...prop };
          }),
          updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
            const prop = properties[where.id];
            if (prop && (where.isAvailable === undefined || prop.isAvailable === where.isAvailable)) {
              if (data.isAvailable !== undefined) prop.isAvailable = data.isAvailable;
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
        conversation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            return { id: `conv-${Date.now()}`, ...data };
          }),
        },
        notification: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const newNotif = {
              id: `notif-${notifications.length + 1}`,
              userId: data.userId,
              type: data.type,
              title: data.title,
              message: data.message,
              referenceId: data.referenceId || null,
              isRead: false,
              readAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            notifications.push(newNotif);
            return newNotif;
          }),
        },
      };

      return await callback(mockTx);
    });

    // Mock direct prisma queries outside transactions
    vi.mocked(prisma.notification.count).mockImplementation(async ({ where }: any) => {
      return notifications.filter((n) => {
        if (where.userId && n.userId !== where.userId) return false;
        if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
        return true;
      }).length;
    });

    vi.mocked(prisma.notification.create).mockImplementation(async ({ data }: any) => {
      const newNotif = {
        id: `notif-${notifications.length + 1}`,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        referenceId: data.referenceId || null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      notifications.push(newNotif);
      return newNotif;
    });

    vi.mocked(prisma.notification.createMany).mockImplementation(async ({ data }: any) => {
      for (const item of data) {
        notifications.push({
          id: `notif-${notifications.length + 1}`,
          userId: item.userId,
          type: item.type,
          title: item.title,
          message: item.message,
          referenceId: item.referenceId || null,
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return { count: data.length };
    });

    vi.mocked(prisma.notification.createManyAndReturn).mockImplementation(async ({ data }: any) => {
      const created = data.map((item: any, idx: number) => ({
        id: `notif-${notifications.length + idx + 1}`,
        userId: item.userId,
        type: item.type,
        title: item.title,
        message: item.message,
        referenceId: item.referenceId || null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      notifications.push(...created);
      return created;
    });
  });

  // =========================================================================
  // Requirement 1: Owner explicitly rejects a PENDING request
  // =========================================================================
  it('1. Owner explicitly rejects a PENDING request: updates status to REJECTED and creates one REQUEST_REJECTED notification', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: 'owner-1',
      userRole: 'OWNER',
      params: { id: 'req-pending-1' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().success).toBe(true);
    expect(getData().data.status).toBe('REJECTED');
    expect(rentalRequests['req-pending-1'].status).toBe('REJECTED');

    // Tenant receives exactly one REQUEST_REJECTED notification
    const tenantNotifications = notifications.filter((n) => n.userId === 'tenant-1');
    expect(tenantNotifications).toHaveLength(1);
    expect(tenantNotifications[0].type).toBe('REQUEST_REJECTED');
    expect(tenantNotifications[0].title).toBe('Request Rejected');
    expect(tenantNotifications[0].message).toBe('Your rental request for "Sunny Seaside 2BHK" was not accepted.');
    expect(tenantNotifications[0].referenceId).toBe('req-pending-1');
  });

  // =========================================================================
  // Requirement 2: Tenant unread notification count increases correctly
  // =========================================================================
  it('2. Tenant unread notification count increases correctly upon rejection', async () => {
    // Check initial unread count
    const { req: countReqBefore, res: countResBefore, getData: getCountBefore } = createMockReqRes({
      userId: 'tenant-1',
      userRole: 'TENANT',
    });
    await getUnreadCount(countReqBefore, countResBefore);
    expect(getCountBefore().count).toBe(0);

    // Reject the request
    const { req: rejectReq, res: rejectRes, getStatus: getRejectStatus } = createMockReqRes({
      userId: 'owner-1',
      userRole: 'OWNER',
      params: { id: 'req-pending-1' },
    });
    await rejectRequest(rejectReq, rejectRes);
    expect(getRejectStatus()).toBe(200);

    // Check updated unread count
    const { req: countReqAfter, res: countResAfter, getData: getCountAfter } = createMockReqRes({
      userId: 'tenant-1',
      userRole: 'TENANT',
    });
    await getUnreadCount(countReqAfter, countResAfter);
    expect(getCountAfter().count).toBe(1);
    expect(notifications[0].isRead).toBe(false);
  });

  // =========================================================================
  // Requirement 3: Tenant receives notification through the existing SSE stream
  // =========================================================================
  it('3. Tenant receives the notification through the existing SSE stream', async () => {
    const sseReceived: any[] = [];
    const eventHandler = (payload: any) => {
      sseReceived.push(payload);
    };

    // Tenant subscribes to notificationEventEmitter
    notificationEventEmitter.on('notification:tenant-1', eventHandler);

    try {
      const { req, res, getStatus } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-pending-1' },
      });

      await rejectRequest(req, res);
      expect(getStatus()).toBe(200);

      // Allow microtask resolution for dynamic import emission
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sseReceived).toHaveLength(1);
      expect(sseReceived[0].type).toBe('REQUEST_REJECTED');
      expect(sseReceived[0].userId).toBe('tenant-1');
      expect(sseReceived[0].referenceId).toBe('req-pending-1');
      expect(sseReceived[0].title).toBe('Request Rejected');
    } finally {
      notificationEventEmitter.off('notification:tenant-1', eventHandler);
    }
  });

  // =========================================================================
  // Requirement 4: Notification contains the correct request reference
  // =========================================================================
  it('4. Notification contains the exact requestId reference matching the rejected request', async () => {
    const { req, res, getStatus } = createMockReqRes({
      userId: 'owner-1',
      userRole: 'OWNER',
      params: { id: 'req-pending-1' },
    });

    await rejectRequest(req, res);
    expect(getStatus()).toBe(200);

    const notif = notifications.find((n) => n.referenceId === 'req-pending-1');
    expect(notif).toBeDefined();
    expect(notif?.referenceId).toBe('req-pending-1');
    expect(notif?.type).toBe('REQUEST_REJECTED');
  });

  // =========================================================================
  // Requirement 5: Unrelated users do not receive the notification
  // =========================================================================
  it('5. Unrelated users do not receive the notification via SSE or database query', async () => {
    const unrelatedReceived: any[] = [];
    const unrelatedHandler = (payload: any) => {
      unrelatedReceived.push(payload);
    };

    notificationEventEmitter.on('notification:tenant-2', unrelatedHandler);
    notificationEventEmitter.on('notification:unrelated-user', unrelatedHandler);

    try {
      const { req, res, getStatus } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-pending-1' }, // tenant-1's request
      });

      await rejectRequest(req, res);
      expect(getStatus()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // No SSE messages for tenant-2 or unrelated-user
      expect(unrelatedReceived).toHaveLength(0);

      // No database notification created for tenant-2
      const tenant2Notifs = notifications.filter((n) => n.userId === 'tenant-2');
      expect(tenant2Notifs).toHaveLength(0);
    } finally {
      notificationEventEmitter.off('notification:tenant-2', unrelatedHandler);
      notificationEventEmitter.off('notification:unrelated-user', unrelatedHandler);
    }
  });

  // =========================================================================
  // Requirement 6: A second rejection attempt cannot create duplicate notifications
  // =========================================================================
  it('6. A second rejection attempt is rejected with 409 and does not create duplicate notifications', async () => {
    const sseEvents: any[] = [];
    const eventHandler = (payload: any) => {
      sseEvents.push(payload);
    };
    notificationEventEmitter.on('notification:tenant-1', eventHandler);

    try {
      // First rejection attempt
      const { req: req1, res: res1, getStatus: getStatus1 } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-pending-1' },
      });
      await rejectRequest(req1, res1);
      expect(getStatus1()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(notifications).toHaveLength(1);
      expect(sseEvents).toHaveLength(1);

      // Second rejection attempt (same requestId)
      const { req: req2, res: res2, getStatus: getStatus2, getData: getData2 } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-pending-1' },
      });
      await rejectRequest(req2, res2);

      // Must be rejected with 409 Conflict
      expect(getStatus2()).toBe(409);
      expect(getData2().message).toBe('Only PENDING requests can be rejected');

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert zero duplicate notifications and zero additional SSE events
      expect(notifications).toHaveLength(1);
      expect(sseEvents).toHaveLength(1);
    } finally {
      notificationEventEmitter.off('notification:tenant-1', eventHandler);
    }
  });

  // =========================================================================
  // Requirement 7: A non-owner cannot reject the request
  // =========================================================================
  it('7. A non-owner cannot reject the request: returns 403 Forbidden without modifying status or notifying', async () => {
    const sseEvents: any[] = [];
    const eventHandler = (payload: any) => {
      sseEvents.push(payload);
    };
    notificationEventEmitter.on('notification:tenant-1', eventHandler);

    try {
      // Impostor or unauthorized owner tries to reject
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-2', // prop-1 is owned by owner-1, not owner-2
        userRole: 'OWNER',
        params: { id: 'req-pending-1' },
      });

      await rejectRequest(req, res);

      expect(getStatus()).toBe(403);
      expect(getData().message).toBe('Forbidden');
      expect(rentalRequests['req-pending-1'].status).toBe('PENDING'); // Unchanged

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(notifications).toHaveLength(0);
      expect(sseEvents).toHaveLength(0);
    } finally {
      notificationEventEmitter.off('notification:tenant-1', eventHandler);
    }
  });

  // =========================================================================
  // Requirement 8: An already accepted or rejected request cannot generate an additional rejection notification
  // =========================================================================
  it('8a. An already ACCEPTED request cannot generate a rejection notification (409 Conflict)', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: 'owner-2',
      userRole: 'OWNER',
      params: { id: 'req-accepted-1' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(409);
    expect(getData().message).toBe('Only PENDING requests can be rejected');
    expect(notifications).toHaveLength(0);
  });

  it('8b. An already REJECTED request cannot generate an additional rejection notification (409 Conflict)', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: 'owner-2',
      userRole: 'OWNER',
      params: { id: 'req-rejected-1' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(409);
    expect(getData().message).toBe('Only PENDING requests can be rejected');
    expect(notifications).toHaveLength(0);
  });

  it('8c. A CANCELLED request cannot generate a rejection notification (409 Conflict)', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: 'owner-1',
      userRole: 'OWNER',
      params: { id: 'req-cancelled-1' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(409);
    expect(getData().message).toBe('Only PENDING requests can be rejected');
    expect(notifications).toHaveLength(0);
  });

  // =========================================================================
  // Requirement 9: Existing automatic rejection notifications in acceptRequest continue working
  // =========================================================================
  it('9. Existing automatic rejection notifications in acceptRequest continue working for competing requests', async () => {
    const sseTenant1: any[] = [];
    const sseTenant2: any[] = [];

    notificationEventEmitter.on('notification:tenant-1', (p) => sseTenant1.push(p));
    notificationEventEmitter.on('notification:tenant-2', (p) => sseTenant2.push(p));

    try {
      // Owner-1 accepts req-pending-1 on prop-1, which also has competing req-pending-2
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: 'owner-1',
        userRole: 'OWNER',
        params: { id: 'req-pending-1' },
      });

      await acceptRequest(req, res);

      expect(getStatus()).toBe(200);
      expect(getData().success).toBe(true);

      // Verify statuses
      expect(rentalRequests['req-pending-1'].status).toBe('ACCEPTED');
      expect(rentalRequests['req-pending-2'].status).toBe('REJECTED');

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Tenant 1 received REQUEST_ACCEPTED
      const tenant1Notif = notifications.find((n) => n.userId === 'tenant-1');
      expect(tenant1Notif).toBeDefined();
      expect(tenant1Notif?.type).toBe('REQUEST_ACCEPTED');
      expect(tenant1Notif?.referenceId).toBe('req-pending-1');

      // Competing Tenant 2 received REQUEST_REJECTED
      const tenant2Notif = notifications.find((n) => n.userId === 'tenant-2');
      expect(tenant2Notif).toBeDefined();
      expect(tenant2Notif?.type).toBe('REQUEST_REJECTED');
      expect(tenant2Notif?.referenceId).toBe('req-pending-2');
      expect(tenant2Notif?.message).toBe('Your rental request for "Sunny Seaside 2BHK" was not accepted.');

      // Verify SSE was received for both
      expect(sseTenant1.some((e) => e.type === 'REQUEST_ACCEPTED')).toBe(true);
      expect(sseTenant2.some((e) => e.type === 'REQUEST_REJECTED')).toBe(true);
    } finally {
      notificationEventEmitter.removeAllListeners('notification:tenant-1');
      notificationEventEmitter.removeAllListeners('notification:tenant-2');
    }
  });

  // =========================================================================
  // Additional Edge Cases: Authentication and Not Found
  // =========================================================================
  it('returns 401 Unauthenticated when user context is missing', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: undefined,
      params: { id: 'req-pending-1' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(401);
    expect(getData().message).toBe('Unauthenticated');
    expect(notifications).toHaveLength(0);
  });

  it('returns 404 Not Found when rental request does not exist', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      userId: 'owner-1',
      params: { id: 'non-existent-req-id' },
    });

    await rejectRequest(req, res);

    expect(getStatus()).toBe(404);
    expect(getData().message).toBe('Request not found');
    expect(notifications).toHaveLength(0);
  });
});
