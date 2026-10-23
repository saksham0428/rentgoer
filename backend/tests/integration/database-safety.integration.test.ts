import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestPrismaClient,
  assertTestDatabaseSafety,
  ScopedTestContext,
  teardownTestDatabase,
} from '../helpers/test-db-context';

describe('Local PostgreSQL Safety & Schema Integration Tests', () => {
  const { prisma, target } = getTestPrismaClient();
  const context = new ScopedTestContext(prisma);

  beforeAll(async () => {
    // Mandatory safety gate: assert loopback and rentgoer_test before running any integration tests
    await assertTestDatabaseSafety(prisma);
  });

  afterAll(async () => {
    await context.cleanup();
    await teardownTestDatabase();
  });

  it('strictly connects to local loopback and verifies database identity is rentgoer_test', async () => {
    const identity = await assertTestDatabaseSafety(prisma);

    expect(identity.currentDatabase).toBe('rentgoer_test');
    expect(target.database).toBe('rentgoer_test');
    expect(target.isLocal).toBe(true);
    expect(['localhost', '127.0.0.1', '::1']).toContain(target.hostname);
  });

  it('verifies all expected application schema tables are present in rentgoer_test', async () => {
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tableNames = tables.map((t) => t.table_name);

    const requiredTables = [
      'User',
      'Session',
      'RevokedLegacyToken',
      'Property',
      'PropertyImage',
      'Favorite',
      'RentalRequest',
      'Conversation',
      'Message',
      'Notification',
      'Review',
      'Report',
      'VerificationRequest',
      '_prisma_migrations',
    ];

    for (const tableName of requiredTables) {
      expect(tableNames).toContain(tableName);
    }
  });

  it('executes database health check query SELECT 1 against rentgoer_test', async () => {
    const result: any[] = await prisma.$queryRaw`SELECT 1 as healthy`;
    expect(result).toHaveLength(1);
    expect(result[0].healthy).toBe(1);
  });

  it('enforces scoped cleanup tracking without unbounded deleteMany', async () => {
    const testEmail = `scoped_test_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        name: 'Scoped Cleanup Test User',
        email: testEmail,
        passwordHash: '$2b$10$dummyHashForTestPurposesOnly',
        role: 'TENANT',
      },
    });

    context.trackUser(user.id);
    expect(context.userIds.has(user.id)).toBe(true);

    // Verify user exists in database
    const foundBefore = await prisma.user.findUnique({ where: { id: user.id } });
    expect(foundBefore).not.toBeNull();
    expect(foundBefore?.email).toBe(testEmail);

    // Perform scoped cleanup
    await context.cleanup();

    // Verify user was cleanly pruned
    const foundAfter = await prisma.user.findUnique({ where: { id: user.id } });
    expect(foundAfter).toBeNull();
    expect(context.userIds.size).toBe(0);
  });
});
