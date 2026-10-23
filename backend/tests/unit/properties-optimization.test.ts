import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the Prisma client before importing controller to ensure zero real database or network operations
vi.mock('../../src/lib/prisma', () => {
  return {
    prisma: {
      property: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      review: {
        groupBy: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../src/lib/prisma';
import { getProperties } from '../../src/controllers/property.controller';

// Helper to create mock Express Request & Response objects
function createMockReqRes(options: {
  query?: Record<string, any>;
}) {
  const req: Partial<Request> = {
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

describe('Properties Controller Optimization & Regression Tests (getProperties)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path: review aggregation and pagination
  // -------------------------------------------------------------------------
  describe('Review Aggregation & Listing Response', () => {
    it('returns properties with correctly aggregated reviews and pagination', async () => {
      const mockProperties = [
        {
          id: 'prop-1',
          title: 'Cozy Downtown Studio',
          rent: 20000,
          city: 'Mumbai',
          locality: 'Bandra',
          owner: { id: 'owner-1', name: 'Alice', email: 'alice@test.com', phone: '1234567890', isVerified: true },
          images: [{ id: 'img-1', url: 'https://example.com/1.jpg', publicId: 'p1' }],
        },
        {
          id: 'prop-2',
          title: 'Spacious 2BHK',
          rent: 35000,
          city: 'Mumbai',
          locality: 'Andheri',
          owner: { id: 'owner-2', name: 'Bob', email: 'bob@test.com', phone: '0987654321', isVerified: false },
          images: [],
        },
      ];

      let countArgsCaptured: any = null;
      let findManyArgsCaptured: any = null;
      let groupByArgsCaptured: any = null;

      vi.mocked(prisma.property.count).mockImplementation(async (args: any) => {
        countArgsCaptured = args;
        return 15;
      });

      vi.mocked(prisma.property.findMany).mockImplementation(async (args: any) => {
        findManyArgsCaptured = args;
        return mockProperties as any;
      });

      vi.mocked(prisma.review.groupBy).mockImplementation(async (args: any) => {
        groupByArgsCaptured = args;
        return [
          { propertyId: 'prop-1', _avg: { rating: 4.6666 }, _count: 3 },
          // prop-2 has no reviews in groupBy result
        ] as any;
      });

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(prisma.property.count).toHaveBeenCalledTimes(1);
      expect(prisma.property.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.review.groupBy).toHaveBeenCalledTimes(1);

      expect(countArgsCaptured.where.isAvailable).toBe(true);
      expect(findManyArgsCaptured.skip).toBe(0);
      expect(findManyArgsCaptured.take).toBe(12);
      expect(groupByArgsCaptured.by).toEqual(['propertyId']);
      expect(groupByArgsCaptured.where.propertyId.in).toEqual(['prop-1', 'prop-2']);

      const body = getData();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);

      // Verify prop-1 review calculations (rounded to 1 decimal)
      expect(body.data[0].id).toBe('prop-1');
      expect(body.data[0].averageRating).toBe(4.7);
      expect(body.data[0].reviewCount).toBe(3);
      expect(body.data[0].owner.name).toBe('Alice');

      // Verify prop-2 defaults when no reviews exist
      expect(body.data[1].id).toBe('prop-2');
      expect(body.data[1].averageRating).toBe(0);
      expect(body.data[1].reviewCount).toBe(0);

      // Verify pagination
      expect(body.pagination).toEqual({
        page: 1,
        limit: 12,
        total: 15,
        totalPages: 2, // Math.ceil(15 / 12)
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Concurrency execution of count and findMany via Promise.all
  // -------------------------------------------------------------------------
  describe('Concurrency & Optimization', () => {
    it('executes count and findMany concurrently', async () => {
      let countStartedAt = 0;
      let findManyStartedAt = 0;

      vi.mocked(prisma.property.count).mockImplementation(async () => {
        countStartedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 5;
      });

      vi.mocked(prisma.property.findMany).mockImplementation(async () => {
        findManyStartedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      });

      vi.mocked(prisma.review.groupBy).mockResolvedValue([]);

      const { req, res, getStatus } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      // Both should have started within a few milliseconds of each other (concurrent dispatch via Promise.all)
      const diff = Math.abs(countStartedAt - findManyStartedAt);
      expect(diff).toBeLessThan(25);
    });

    // -------------------------------------------------------------------------
    // 3. Short-circuits review groupBy when findMany returns 0 properties
    // -------------------------------------------------------------------------
    it('short-circuits review groupBy when 0 properties match', async () => {
      vi.mocked(prisma.property.count).mockResolvedValue(0);
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus, getData } = createMockReqRes({
        query: { city: 'NonExistentCity' },
      });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(prisma.review.groupBy).not.toHaveBeenCalled();

      const body = getData();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pagination parameters and limits
  // -------------------------------------------------------------------------
  describe('Pagination', () => {
    it('respects page, limit, and skip calculations', async () => {
      let capturedSkip = -1;
      let capturedTake = -1;

      vi.mocked(prisma.property.count).mockResolvedValue(45);
      vi.mocked(prisma.property.findMany).mockImplementation(async (args: any) => {
        capturedSkip = args.skip;
        capturedTake = args.take;
        return [];
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        query: { page: '3', limit: '10' },
      });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedSkip).toBe(20); // (3 - 1) * 10
      expect(capturedTake).toBe(10);
      expect(getData().pagination).toEqual({
        page: 3,
        limit: 10,
        total: 45,
        totalPages: 5,
      });
    });

    it('defaults to page 1 and limit 12 when query params are omitted', async () => {
      let capturedSkip = -1;
      let capturedTake = -1;

      vi.mocked(prisma.property.count).mockResolvedValue(24);
      vi.mocked(prisma.property.findMany).mockImplementation(async (args: any) => {
        capturedSkip = args.skip;
        capturedTake = args.take;
        return [];
      });

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedSkip).toBe(0);
      expect(capturedTake).toBe(12);
      expect(getData().pagination).toEqual({
        page: 1,
        limit: 12,
        total: 24,
        totalPages: 2,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Sorting mappings
  // -------------------------------------------------------------------------
  describe('Sorting Mappings', () => {
    it('applies correct sortBy mappings for rent_asc, rent_desc, verified, newest, and default', async () => {
      const capturedOrders: any[] = [];

      vi.mocked(prisma.property.count).mockResolvedValue(1);
      vi.mocked(prisma.property.findMany).mockImplementation(async (args: any) => {
        capturedOrders.push(args.orderBy);
        return [];
      });

      // Test rent_asc
      let mock = createMockReqRes({ query: { sortBy: 'rent_asc' } });
      await getProperties(mock.req, mock.res);
      expect(capturedOrders[0]).toEqual({ rent: 'asc' });

      // Test rent_desc
      mock = createMockReqRes({ query: { sortBy: 'rent_desc' } });
      await getProperties(mock.req, mock.res);
      expect(capturedOrders[1]).toEqual({ rent: 'desc' });

      // Test verified
      mock = createMockReqRes({ query: { sortBy: 'verified' } });
      await getProperties(mock.req, mock.res);
      expect(capturedOrders[2]).toEqual([{ isVerified: 'desc' }, { createdAt: 'desc' }]);

      // Test default (omitted sortBy -> newest)
      mock = createMockReqRes({ query: {} });
      await getProperties(mock.req, mock.res);
      expect(capturedOrders[3]).toEqual({ createdAt: 'desc' });

      // Test explicit newest
      mock = createMockReqRes({ query: { sortBy: 'newest' } });
      await getProperties(mock.req, mock.res);
      expect(capturedOrders[4]).toEqual({ createdAt: 'desc' });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Query filters
  // -------------------------------------------------------------------------
  describe('Query Filters', () => {
    it('applies query filter conditions accurately for all supported fields', async () => {
      let capturedWhere: any = null;

      vi.mocked(prisma.property.count).mockImplementation(async (args: any) => {
        capturedWhere = args.where;
        return 1;
      });
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus } = createMockReqRes({
        query: {
          city: 'Pune',
          locality: 'Kothrud',
          minRent: '10000',
          maxRent: '25000',
          bedrooms: '2',
          bathrooms: '2',
          isVerified: 'true',
          isAvailable: 'false',
        },
      });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedWhere.city).toEqual({ contains: 'Pune', mode: 'insensitive' });
      expect(capturedWhere.locality).toEqual({ contains: 'Kothrud', mode: 'insensitive' });
      expect(capturedWhere.rent).toEqual({ gte: 10000, lte: 25000 });
      expect(capturedWhere.bedrooms).toBe(2);
      expect(capturedWhere.bathrooms).toBe(2);
      expect(capturedWhere.isVerified).toBe(true);
      expect(capturedWhere.isAvailable).toBe(false);
    });

    it('applies propertyType and furnishedStatus enum filters correctly', async () => {
      let capturedWhere: any = null;

      vi.mocked(prisma.property.count).mockImplementation(async (args: any) => {
        capturedWhere = args.where;
        return 1;
      });
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus } = createMockReqRes({
        query: {
          propertyType: 'APARTMENT',
          furnishedStatus: 'FURNISHED',
        },
      });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedWhere.propertyType).toBe('APARTMENT');
      expect(capturedWhere.furnishedStatus).toBe('FURNISHED');
    });

    it('defaults isAvailable to true when not provided in query', async () => {
      let capturedWhere: any = null;

      vi.mocked(prisma.property.count).mockImplementation(async (args: any) => {
        capturedWhere = args.where;
        return 1;
      });
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedWhere.isAvailable).toBe(true);
    });

    it('does not filter by isVerified when isVerified is false (only filters when isVerified is true)', async () => {
      let capturedWhere: any = null;

      vi.mocked(prisma.property.count).mockImplementation(async (args: any) => {
        capturedWhere = args.where;
        return 1;
      });
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus } = createMockReqRes({
        query: { isVerified: 'false' },
      });
      await getProperties(req, res);

      expect(getStatus()).toBe(200);
      expect(capturedWhere.isVerified).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Error handling
  // -------------------------------------------------------------------------
  describe('Error Handling', () => {
    it('handles database errors gracefully and returns 500 when count rejects', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(prisma.property.count).mockRejectedValue(new Error('Supabase connection pool timeout'));
      vi.mocked(prisma.property.findMany).mockResolvedValue([]);

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(500);
      expect(getData()).toEqual({
        success: false,
        message: 'Internal server error',
      });

      consoleErrorSpy.mockRestore();
    });

    it('handles database errors gracefully and returns 500 when findMany rejects', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(prisma.property.count).mockResolvedValue(10);
      vi.mocked(prisma.property.findMany).mockRejectedValue(new Error('Query timeout'));

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      expect(getStatus()).toBe(500);
      expect(getData()).toEqual({
        success: false,
        message: 'Internal server error',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Input validation errors (400 responses)
  // -------------------------------------------------------------------------
  describe('Input Validation (400 Responses)', () => {
    it('returns 400 when minRent exceeds maxRent', async () => {
      const mock = createMockReqRes({ query: { minRent: '50000', maxRent: '20000' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('minRent cannot exceed maxRent');
    });

    it('returns 400 for invalid page value (0 or negative or non-number)', async () => {
      let mock = createMockReqRes({ query: { page: '0' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid page value');

      mock = createMockReqRes({ query: { page: '-5' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid page value');

      mock = createMockReqRes({ query: { page: 'invalid' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid page value');
    });

    it('returns 400 for invalid limit value (> 50 or < 1)', async () => {
      let mock = createMockReqRes({ query: { limit: '100' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid limit value (must be 1-50)');

      mock = createMockReqRes({ query: { limit: '0' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid limit value (must be 1-50)');
    });

    it('returns 400 for invalid sortBy value', async () => {
      const mock = createMockReqRes({ query: { sortBy: 'unknown_sort' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid sortBy value');
    });

    it('returns 400 for invalid minRent format', async () => {
      let mock = createMockReqRes({ query: { minRent: 'not-a-number' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid minRent value');

      mock = createMockReqRes({ query: { minRent: '-100' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid minRent value');
    });

    it('returns 400 for invalid maxRent format', async () => {
      let mock = createMockReqRes({ query: { maxRent: 'not-a-number' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid maxRent value');

      mock = createMockReqRes({ query: { maxRent: '-100' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid maxRent value');
    });

    it('returns 400 for invalid bedrooms or bathrooms values', async () => {
      let mock = createMockReqRes({ query: { bedrooms: 'not-a-number' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid bedrooms value');

      mock = createMockReqRes({ query: { bathrooms: '-1' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid bathrooms value');
    });

    it('returns 400 for invalid propertyType value', async () => {
      const mock = createMockReqRes({ query: { propertyType: 'MANSION' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid propertyType value');
    });

    it('returns 400 for invalid furnishedStatus value', async () => {
      const mock = createMockReqRes({ query: { furnishedStatus: 'LUXURY' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid furnishedStatus value');
    });

    it('returns 400 for invalid isVerified and isAvailable boolean strings', async () => {
      let mock = createMockReqRes({ query: { isVerified: 'yes' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid isVerified value');

      mock = createMockReqRes({ query: { isAvailable: 'no' } });
      await getProperties(mock.req, mock.res);
      expect(mock.getStatus()).toBe(400);
      expect(mock.getData().message).toBe('Invalid isAvailable value');
    });
  });
});
