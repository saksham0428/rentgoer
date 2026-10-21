/**
 * SEC-01B Policy A — Real PostgreSQL Integration Test Suite
 *
 * NOTE: This test script requires a real PostgreSQL database with migration
 * "20261021000000_add_sessions_and_legacy_revocation" applied.
 *
 * Strict Safety Rules:
 * - Migrations and tests must run ONLY against local test database (localhost:5432/rentgoer_test).
 * - Never fall back to .env or remote Supabase.
 * - Validates host, port, and database before establishing connection.
 * - Runtime SQL verification of current_database() before any write operation.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

console.log('======================================================================');
console.log('🐘 SEC-01B POLICY A — REAL POSTGRESQL INTEGRATION TEST SUITE');
console.log('======================================================================\n');

// 1. Strict Environment Loading & URL Validation (Localhost Only)
const envPath = path.resolve(__dirname, '../.env.test.local');
if (!fs.existsSync(envPath)) {
  console.error('FATAL SAFETY ERROR: .env.test.local not found!');
  console.error('Integration tests must run against a verified local test database.');
  process.exit(1);
}

const testEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
if (!testEnv.DATABASE_URL) {
  console.error('FATAL SAFETY ERROR: DATABASE_URL not defined in .env.test.local!');
  process.exit(1);
}

let parsedDbUrl: URL;
try {
  parsedDbUrl = new URL(testEnv.DATABASE_URL);
} catch (err: any) {
  console.error('FATAL SAFETY ERROR: Invalid DATABASE_URL in .env.test.local:', err.message);
  process.exit(1);
}

if (parsedDbUrl.protocol !== 'postgresql:' && parsedDbUrl.protocol !== 'postgres:') {
  console.error(`FATAL SAFETY ERROR: Protocol must be postgresql:, got: ${parsedDbUrl.protocol}`);
  process.exit(1);
}

if (parsedDbUrl.hostname !== 'localhost' && parsedDbUrl.hostname !== '127.0.0.1') {
  console.error(`SAFETY ABORT: Hostname must be localhost or 127.0.0.1! Got: ${parsedDbUrl.hostname}`);
  process.exit(1);
}

if (parsedDbUrl.port !== '5432') {
  console.error(`SAFETY ABORT: Port must be 5432! Got: ${parsedDbUrl.port}`);
  process.exit(1);
}

const targetDb = parsedDbUrl.pathname.replace(/^\//, '');
if (targetDb !== 'rentgoer_test') {
  console.error(`SAFETY ABORT: Target database must be rentgoer_test! Got: ${targetDb}`);
  process.exit(1);
}

// Override process.env BEFORE loading application modules
process.env.DATABASE_URL = testEnv.DATABASE_URL;
process.env.DIRECT_URL = testEnv.DIRECT_URL || testEnv.DATABASE_URL;

console.log('✓ Target environment verified:');
console.log('  - Host:     %s', parsedDbUrl.hostname);
console.log('  - Port:     %s', parsedDbUrl.port);
console.log('  - Database: %s', targetDb);
console.log('  - Config:   .env.test.local\n');

async function runPostgresIntegrationTests() {
  // Dynamically import application modules AFTER environment variables are overridden
  const { prisma } = await import('../src/lib/prisma');
  const { cleanupExpiredAuthRecords } = await import('../src/scripts/cleanup-sessions');
  const crypto = await import('crypto');

  // 2. Runtime SQL Database Verification
  console.log('Executing runtime database verification query...');
  const dbVerification: any[] = await prisma.$queryRaw`SELECT current_database(), current_user`;
  if (!dbVerification || dbVerification.length === 0 || dbVerification[0].current_database !== 'rentgoer_test') {
    throw new Error(
      `SAFETY ABORT: Database name check failed! Connected to '${dbVerification?.[0]?.current_database}', expected 'rentgoer_test'`
    );
  }
  console.log('✓ Runtime connection confirmed: connected to "%s" as "%s".\n', dbVerification[0].current_database, dbVerification[0].current_user);

  // 3. Verify Table Existence
  console.log('Verifying Session & RevokedLegacyToken tables in PostgreSQL...');
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Session" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "RevokedLegacyToken" LIMIT 1`;
    console.log('✓ Tables "Session" and "RevokedLegacyToken" verified in local database.\n');
  } catch (err: any) {
    throw new Error(`Missing required tables in rentgoer_test: ${err.message}. Run local migrations first.`);
  }

  const testEmail = `integration_test_session_${Date.now()}@example.com`;
  let userId: string = '';
  const createdSessionIds: string[] = [];
  const createdTokenHashes: string[] = [];

  try {
    // 4. Create Test User
    console.log('--- Step 1: Creating Test User in PostgreSQL ---');
    const user = await prisma.user.create({
      data: {
        name: 'Integration Test User',
        email: testEmail,
        passwordHash: '$2b$10$w8TKnq5LzH1g5.o4Qv2Y8eO5q4O8fF8U8w8TKnq5LzH1g5.o4Qv2Y', // dummy hash
        role: 'TENANT',
        tokenVersion: 0,
      },
    });
    userId = user.id;
    console.log(`✓ User created with ID: ${userId}, tokenVersion: 0`);

    // 5. Create Multi-Device Sessions (Device A and Device B)
    console.log('\n--- Step 2: Creating Multi-Device Sessions in PostgreSQL ---');
    const sessionA = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'IntegrationTest/DeviceA (macOS)',
        ipAddress: '192.168.1.10',
      },
    });
    createdSessionIds.push(sessionA.id);

    const sessionB = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'IntegrationTest/DeviceB (iPhone)',
        ipAddress: '192.168.1.20',
      },
    });
    createdSessionIds.push(sessionB.id);

    console.log(`✓ Session A created: ${sessionA.id}`);
    console.log(`✓ Session B created: ${sessionB.id}`);

    // 6. Verify Single-Query Join
    console.log('\n--- Step 3: Verifying Joined Session + User Lookup ---');
    const fetchedSessionA = await prisma.session.findUnique({
      where: { id: sessionA.id },
      include: {
        user: {
          select: { id: true, role: true, tokenVersion: true },
        },
      },
    });
    if (!fetchedSessionA || fetchedSessionA.user.id !== userId) {
      throw new Error('Failed to retrieve session with joined user');
    }
    console.log('✓ Successfully executed indexed PK join between Session and User');

    // 7. Logout on Device A (Revoke Session A only)
    console.log('\n--- Step 4: Device A Logout (Session-Specific Revocation) ---');
    const revokeResult = await prisma.session.updateMany({
      where: {
        id: sessionA.id,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    if (revokeResult.count !== 1) {
      throw new Error(`Expected exactly 1 session revoked, got: ${revokeResult.count}`);
    }

    // Verify Session A is revoked
    const checkA = await prisma.session.findUnique({ where: { id: sessionA.id } });
    if (!checkA?.revokedAt) {
      throw new Error('Session A was not marked revoked in PostgreSQL');
    }
    console.log(`✓ Session A revokedAt set to: ${checkA.revokedAt.toISOString()}`);

    // Verify Device B REMAINS ACTIVE
    const checkB = await prisma.session.findUnique({ where: { id: sessionB.id } });
    if (checkB?.revokedAt !== null) {
      throw new Error('SECURITY VIOLATION: Session B was unexpectedly revoked when Session A logged out!');
    }
    console.log('✓ Device B verified active in PostgreSQL (revokedAt is null). Device isolation confirmed!');

    // 8. Test Concurrent Logouts on Same Session
    console.log('\n--- Step 5: Testing Concurrent Repeated Logouts on PostgreSQL ---');
    const concurrentResults = await Promise.all([
      prisma.session.updateMany({ where: { id: sessionA.id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { id: sessionA.id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { id: sessionA.id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    console.log(`✓ 3 concurrent logout updates completed safely without errors or deadlocks.`);

    // 9. Legacy Token Revocation & Upsert Concurrency
    console.log('\n--- Step 6: Testing Legacy Token Revocation & Concurrent Upserts ---');
    const dummyJwt = `dummy.jwt.token.${Date.now()}`;
    const tokenHash = crypto.createHash('sha256').update(dummyJwt).digest('hex');
    createdTokenHashes.push(tokenHash);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Run 5 parallel upserts with same tokenHash to prove PostgreSQL concurrency safety
    await Promise.all([
      prisma.revokedLegacyToken.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, userId, expiresAt } }),
      prisma.revokedLegacyToken.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, userId, expiresAt } }),
      prisma.revokedLegacyToken.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, userId, expiresAt } }),
      prisma.revokedLegacyToken.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, userId, expiresAt } }),
      prisma.revokedLegacyToken.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, userId, expiresAt } }),
    ]);

    const persistedHash = await prisma.revokedLegacyToken.findUnique({ where: { tokenHash } });
    if (!persistedHash) {
      throw new Error('Failed to find persisted legacy token hash in PostgreSQL');
    }
    console.log('✓ 5 parallel upserts safely handled by unique index constraint without collisions.');

    // 10. Global Invalidation via Password Change Transaction
    console.log('\n--- Step 7: Testing Global Invalidation Transaction (Password Change) ---');
    const sessionC = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    createdSessionIds.push(sessionC.id);

    // Execute atomic transaction
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

    if (updatedUser?.tokenVersion !== 1) {
      throw new Error(`Expected tokenVersion 1, got ${updatedUser?.tokenVersion}`);
    }
    if (remainingActiveSessions !== 0) {
      throw new Error(`Expected 0 active sessions after password change, found: ${remainingActiveSessions}`);
    }
    console.log('✓ Transaction committed: user.tokenVersion incremented to 1, all active sessions revoked.');

    // 11. Cleanup Script Execution
    console.log('\n--- Step 8: Testing Auth Cleanup Script on Real Database ---');
    const expiredSession = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() - 10000), // 10 seconds in past
      },
    });
    const cleanupResult = await cleanupExpiredAuthRecords();
    console.log(`✓ Cleanup script executed: deleted ${cleanupResult.deletedSessions} expired sessions.`);

    const checkExpiredSession = await prisma.session.findUnique({ where: { id: expiredSession.id } });
    if (checkExpiredSession) {
      throw new Error('Expired session was not pruned by cleanup script');
    }
    console.log('✓ Expired session was successfully pruned from PostgreSQL.');

    console.log('\n🎉 ALL REAL POSTGRESQL INTEGRATION SCENARIOS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    // Cleanup test data
    console.log('Cleaning up test data from PostgreSQL...');
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    for (const hash of createdTokenHashes) {
      await prisma.revokedLegacyToken.deleteMany({ where: { tokenHash: hash } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('Cleanup complete.');
  }
}

runPostgresIntegrationTests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
