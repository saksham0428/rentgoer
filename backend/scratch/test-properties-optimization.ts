import assert from 'assert';
import { Request, Response } from 'express';
import { prisma } from '../src/lib/prisma';
import { getProperties } from '../src/controllers/property.controller';

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

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 GET /api/properties OPTIMIZATION & REGRESSION TEST SUITE');
  console.log('========================================================================\n');

  // Save original prisma methods
  const originalCount = prisma.property.count;
  const originalFindMany = prisma.property.findMany;
  const originalGroupBy = prisma.review.groupBy;

  let passedTests = 0;
  let totalTests = 0;

  function runCase(name: string, fn: () => Promise<void>) {
    totalTests++;
    return fn()
      .then(() => {
        passedTests++;
        console.log(`  ✅ PASS: ${name}`);
      })
      .catch((err) => {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(err);
      });
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Happy path with properties & review aggregation
    // -------------------------------------------------------------------------
    await runCase('Returns properties with correctly aggregated reviews and pagination', async () => {
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

      let countCalled = false;
      let findManyCalled = false;
      let groupByCalled = false;

      (prisma.property.count as any) = async (args: any) => {
        countCalled = true;
        assert.strictEqual(args.where.isAvailable, true);
        return 15;
      };

      (prisma.property.findMany as any) = async (args: any) => {
        findManyCalled = true;
        assert.strictEqual(args.skip, 0);
        assert.strictEqual(args.take, 12);
        return mockProperties;
      };

      (prisma.review.groupBy as any) = async (args: any) => {
        groupByCalled = true;
        assert.deepStrictEqual(args.by, ['propertyId']);
        assert.deepStrictEqual(args.where.propertyId.in, ['prop-1', 'prop-2']);
        return [
          { propertyId: 'prop-1', _avg: { rating: 4.6666 }, _count: 3 },
          // prop-2 has no reviews in groupBy result
        ];
      };

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      assert.strictEqual(getStatus(), 200);
      assert.strictEqual(countCalled, true);
      assert.strictEqual(findManyCalled, true);
      assert.strictEqual(groupByCalled, true);

      const body = getData();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.length, 2);

      // Verify prop-1 review calculations
      assert.strictEqual(body.data[0].id, 'prop-1');
      assert.strictEqual(body.data[0].averageRating, 4.7); // rounded to 1 decimal
      assert.strictEqual(body.data[0].reviewCount, 3);
      assert.strictEqual(body.data[0].owner.name, 'Alice');

      // Verify prop-2 defaults when no reviews exist
      assert.strictEqual(body.data[1].id, 'prop-2');
      assert.strictEqual(body.data[1].averageRating, 0);
      assert.strictEqual(body.data[1].reviewCount, 0);

      // Verify pagination
      assert.deepStrictEqual(body.pagination, {
        page: 1,
        limit: 12,
        total: 15,
        totalPages: 2, // Math.ceil(15 / 12)
      });
    });

    // -------------------------------------------------------------------------
    // Test 2: Concurrency execution of count and findMany via Promise.all
    // -------------------------------------------------------------------------
    await runCase('Executes count and findMany concurrently', async () => {
      let countStartedAt = 0;
      let findManyStartedAt = 0;

      (prisma.property.count as any) = async () => {
        countStartedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 5;
      };

      (prisma.property.findMany as any) = async () => {
        findManyStartedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      };

      (prisma.review.groupBy as any) = async () => {
        return [];
      };

      const { req, res, getStatus } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      assert.strictEqual(getStatus(), 200);
      // Both should have started within a few milliseconds of each other (concurrent dispatch)
      const diff = Math.abs(countStartedAt - findManyStartedAt);
      assert.ok(diff < 25, `Expected count and findMany to start concurrently, difference was ${diff}ms`);
    });

    // -------------------------------------------------------------------------
    // Test 3: Short-circuits review groupBy when findMany returns 0 properties
    // -------------------------------------------------------------------------
    await runCase('Short-circuits review groupBy when 0 properties match', async () => {
      let groupByInvoked = false;

      (prisma.property.count as any) = async () => 0;
      (prisma.property.findMany as any) = async () => [];
      (prisma.review.groupBy as any) = async () => {
        groupByInvoked = true;
        return [];
      };

      const { req, res, getStatus, getData } = createMockReqRes({
        query: { city: 'NonExistentCity' },
      });
      await getProperties(req, res);

      assert.strictEqual(getStatus(), 200);
      assert.strictEqual(groupByInvoked, false, 'review.groupBy must NOT be called when properties list is empty');

      const body = getData();
      assert.strictEqual(body.success, true);
      assert.deepStrictEqual(body.data, []);
      assert.deepStrictEqual(body.pagination, {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
      });
    });

    // -------------------------------------------------------------------------
    // Test 4: Pagination parameters and limits
    // -------------------------------------------------------------------------
    await runCase('Respects page, limit, and skip calculations', async () => {
      let capturedSkip = -1;
      let capturedTake = -1;

      (prisma.property.count as any) = async () => 45;
      (prisma.property.findMany as any) = async (args: any) => {
        capturedSkip = args.skip;
        capturedTake = args.take;
        return [];
      };

      const { req, res, getStatus, getData } = createMockReqRes({
        query: { page: '3', limit: '10' },
      });
      await getProperties(req, res);

      assert.strictEqual(getStatus(), 200);
      assert.strictEqual(capturedSkip, 20); // (3 - 1) * 10
      assert.strictEqual(capturedTake, 10);
      assert.deepStrictEqual(getData().pagination, {
        page: 3,
        limit: 10,
        total: 45,
        totalPages: 5,
      });
    });

    // -------------------------------------------------------------------------
    // Test 5: Sorting mapping
    // -------------------------------------------------------------------------
    await runCase('Applies correct sortBy mappings', async () => {
      const capturedOrders: any[] = [];

      (prisma.property.count as any) = async () => 1;
      (prisma.property.findMany as any) = async (args: any) => {
        capturedOrders.push(args.orderBy);
        return [];
      };

      // Test rent_asc
      let mock = createMockReqRes({ query: { sortBy: 'rent_asc' } });
      await getProperties(mock.req, mock.res);
      assert.deepStrictEqual(capturedOrders[0], { rent: 'asc' });

      // Test rent_desc
      mock = createMockReqRes({ query: { sortBy: 'rent_desc' } });
      await getProperties(mock.req, mock.res);
      assert.deepStrictEqual(capturedOrders[1], { rent: 'desc' });

      // Test verified
      mock = createMockReqRes({ query: { sortBy: 'verified' } });
      await getProperties(mock.req, mock.res);
      assert.deepStrictEqual(capturedOrders[2], [{ isVerified: 'desc' }, { createdAt: 'desc' }]);

      // Test default (newest)
      mock = createMockReqRes({ query: {} });
      await getProperties(mock.req, mock.res);
      assert.deepStrictEqual(capturedOrders[3], { createdAt: 'desc' });
    });

    // -------------------------------------------------------------------------
    // Test 6: Query filters (city, rent range, bedrooms, availability)
    // -------------------------------------------------------------------------
    await runCase('Applies query filter conditions accurately', async () => {
      let capturedWhere: any = null;

      (prisma.property.count as any) = async (args: any) => {
        capturedWhere = args.where;
        return 1;
      };
      (prisma.property.findMany as any) = async () => [];

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

      assert.strictEqual(getStatus(), 200);
      assert.deepStrictEqual(capturedWhere.city, { contains: 'Pune', mode: 'insensitive' });
      assert.deepStrictEqual(capturedWhere.locality, { contains: 'Kothrud', mode: 'insensitive' });
      assert.deepStrictEqual(capturedWhere.rent, { gte: 10000, lte: 25000 });
      assert.strictEqual(capturedWhere.bedrooms, 2);
      assert.strictEqual(capturedWhere.bathrooms, 2);
      assert.strictEqual(capturedWhere.isVerified, true);
      assert.strictEqual(capturedWhere.isAvailable, false);
    });

    // -------------------------------------------------------------------------
    // Test 7: Error handling when count or findMany rejects
    // -------------------------------------------------------------------------
    await runCase('Handles database errors gracefully and returns 500', async () => {
      (prisma.property.count as any) = async () => {
        throw new Error('Supabase connection pool timeout');
      };
      (prisma.property.findMany as any) = async () => [];

      const { req, res, getStatus, getData } = createMockReqRes({ query: {} });
      await getProperties(req, res);

      assert.strictEqual(getStatus(), 500);
      assert.deepStrictEqual(getData(), {
        success: false,
        message: 'Internal server error',
      });
    });

    // -------------------------------------------------------------------------
    // Test 8: Input validation errors (400 responses preserved)
    // -------------------------------------------------------------------------
    await runCase('Preserves 400 validation responses for invalid inputs', async () => {
      // minRent > maxRent
      let mock = createMockReqRes({ query: { minRent: '50000', maxRent: '20000' } });
      await getProperties(mock.req, mock.res);
      assert.strictEqual(mock.getStatus(), 400);
      assert.strictEqual(mock.getData().message, 'minRent cannot exceed maxRent');

      // Invalid page
      mock = createMockReqRes({ query: { page: '0' } });
      await getProperties(mock.req, mock.res);
      assert.strictEqual(mock.getStatus(), 400);
      assert.strictEqual(mock.getData().message, 'Invalid page value');

      // Invalid limit (> 50)
      mock = createMockReqRes({ query: { limit: '100' } });
      await getProperties(mock.req, mock.res);
      assert.strictEqual(mock.getStatus(), 400);
      assert.strictEqual(mock.getData().message, 'Invalid limit value (must be 1-50)');

      // Invalid sortBy
      mock = createMockReqRes({ query: { sortBy: 'unknown_sort' } });
      await getProperties(mock.req, mock.res);
      assert.strictEqual(mock.getStatus(), 400);
      assert.strictEqual(mock.getData().message, 'Invalid sortBy value');
    });

  } finally {
    // Restore original prisma methods
    prisma.property.count = originalCount;
    prisma.property.findMany = originalFindMany;
    prisma.review.groupBy = originalGroupBy;
  }

  console.log('\n========================================================================');
  console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
