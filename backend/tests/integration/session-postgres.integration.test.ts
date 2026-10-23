import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import {
  getTestPrismaClient,
  assertTestDatabaseSafety,
  ScopedTestContext,
  teardownTestDatabase,
} from '../helpers/test-db-context';
import { cleanupExpiredAuthRecords } from '../../src/scripts/cleanup-sessions';

describe('SEC-01B Real PostgreSQL Session & Auth Integration Tests', () => {
  const { prisma } = getTestPrismaClient();
  const context = new ScopedTestContext(prisma);

  let userId: string;
  let sessionAId: string;
  let sessionBId: string;
  let sessionCId: string;
  const tokenHash = crypto.createHash('sha256').update(`jwt.token.${Date.now()}`).digest('hex');

  beforeAll(async () => {
    // 1. Mandatory runtime database identity check
    const identity = await assertTestDatabaseSafety(prisma);
    expect(identity.currentDatabase).toBe('rentgoer_test');

    // 2. Verify Session & RevokedLegacyToken tables in PostgreSQL
    await prisma.$queryRaw`SELECT 1 FROM "Session" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "RevokedLegacyToken" LIMIT 1`;
  });

  afterAll(async () => {
    await context.cleanup();
    await teardownTestDatabase();
  });

  it('Step 1: creates test user in PostgreSQL with tokenVersion = 0', async () => {
    const testEmail = `integration_test_session_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        name: 'Integration Test User',
        email: testEmail,
        passwordHash: '$2b$10$w8TKnq5LzH1g5.o4Qv2Y8eO5q4O8fF8U8w8TKnq5LzH1g5.o4Qv2Y',
        role: 'TENANT',
        tokenVersion: 0,
      },
    });

    userId = user.id;
    context.trackUser(userId);

    expect(user.id).toBeDefined();
    expect(user.tokenVersion).toBe(0);
    expect(user.role).toBe('TENANT');
  });

  it('Step 2: creates multi-device sessions (Device A and Device B)', async () => {
    const sessionA = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'IntegrationTest/DeviceA (macOS)',
        ipAddress: '192.168.1.10',
      },
    });
    sessionAId = sessionA.id;
    context.trackSession(sessionA.id);

    const sessionB = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'IntegrationTest/DeviceB (iPhone)',
        ipAddress: '192.168.1.20',
      },
    });
    sessionBId = sessionB.id;
    context.trackSession(sessionB.id);

    expect(sessionA.id).toBeDefined();
    expect(sessionB.id).toBeDefined();
    expect(sessionA.userId).toBe(userId);
    expect(sessionB.userId).toBe(userId);
    expect(sessionA.revokedAt).toBeNull();
    expect(sessionB.revokedAt).toBeNull();
  });

  it('Step 3: verifies joined Session + User lookup via indexed PK join', async () => {
    const fetchedSessionA = await prisma.session.findUnique({
      where: { id: sessionAId },
      include: {
        user: {
          select: { id: true, role: true, tokenVersion: true },
        },
      },
    });

    expect(fetchedSessionA).not.toBeNull();
    expect(fetchedSessionA?.user.id).toBe(userId);
    expect(fetchedSessionA?.user.role).toBe('TENANT');
    expect(fetchedSessionA?.user.tokenVersion).toBe(0);
  });

  it('Step 4: Device A logout performs session-specific revocation while Device B remains active', async () => {
    const revokeResult = await prisma.session.updateMany({
      where: {
        id: sessionAId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    expect(revokeResult.count).toBe(1);

    // Verify Session A is marked revoked
    const checkA = await prisma.session.findUnique({ where: { id: sessionAId } });
    expect(checkA?.revokedAt).not.toBeNull();

    // Verify Device B REMAINS ACTIVE (multi-device isolation guarantee)
    const checkB = await prisma.session.findUnique({ where: { id: sessionBId } });
    expect(checkB?.revokedAt).toBeNull();
  });

  it('Step 5: handles concurrent repeated logouts on same session safely without errors or deadlocks', async () => {
    const concurrentResults = await Promise.all([
      prisma.session.updateMany({
        where: { id: sessionAId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { id: sessionAId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { id: sessionAId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    expect(concurrentResults).toHaveLength(3);
    // Because Session A was already revoked, all three updateMany count should be 0
    expect(concurrentResults.every((r) => r.count === 0)).toBe(true);
  });

  it('Step 6: legacy token revocation handles concurrent parallel upserts via unique index constraint', async () => {
    context.trackTokenHash(tokenHash);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 5 parallel upserts with same tokenHash:
    // Tests concurrency safety where concurrent requests either upsert or safely recover
    // if unique constraint P2002 is triggered by an in-flight uncommitted transaction
    const runConcurrentUpsert = async () => {
      try {
        return await prisma.revokedLegacyToken.upsert({
          where: { tokenHash },
          update: {},
          create: { tokenHash, userId, expiresAt },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          return await prisma.revokedLegacyToken.findUnique({ where: { tokenHash } });
        }
        throw err;
      }
    };

    const results = await Promise.all([
      runConcurrentUpsert(),
      runConcurrentUpsert(),
      runConcurrentUpsert(),
      runConcurrentUpsert(),
      runConcurrentUpsert(),
    ]);

    expect(results).toHaveLength(5);
    const persistedHash = await prisma.revokedLegacyToken.findUnique({ where: { tokenHash } });
    expect(persistedHash).not.toBeNull();
    expect(persistedHash?.tokenHash).toBe(tokenHash);
    expect(persistedHash?.userId).toBe(userId);
  });

  it('Step 7: global invalidation transaction (password change) atomically increments tokenVersion and revokes all active sessions', async () => {
    const sessionC = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    sessionCId = sessionC.id;
    context.trackSession(sessionC.id);

    // Execute atomic transaction simulating password change
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    const remainingActiveSessions = await prisma.session.count({
      where: { userId, revokedAt: null },
    });

    expect(updatedUser?.tokenVersion).toBe(1);
    expect(remainingActiveSessions).toBe(0);
  });

  it('Step 8: auth cleanup script prunes expired sessions from PostgreSQL', async () => {
    const expiredSession = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() - 10000), // 10 seconds in past
      },
    });
    context.trackSession(expiredSession.id);

    const cleanupResult = await cleanupExpiredAuthRecords();
    expect(cleanupResult.deletedSessions).toBeGreaterThanOrEqual(1);

    const checkExpiredSession = await prisma.session.findUnique({ where: { id: expiredSession.id } });
    expect(checkExpiredSession).toBeNull();
  });
});
