import { PrismaClient } from '@prisma/client';
import {
  applyTestEnvironment,
  sanitizeErrorMessage,
  SanitizedDbTarget,
  isLoopbackIPv4,
} from './test-db-guard';

/**
 * Note on Prisma Client Initialization & Isolation (Fix 3):
 * Under the Vitest integration test setup (backend/vitest.integration.config.mts),
 * setupFiles: ['tests/helpers/setup-integration.ts'] is guaranteed to execute BEFORE
 * any test file or helper module is loaded.
 * 
 * setup-integration.ts immediately invokes applyTestEnvironment(), which validates
 * backend/.env.test.local (requiring loopback and rentgoer_test) and sets
 * process.env.DATABASE_URL and process.env.DIRECT_URL before src/lib/prisma is evaluated.
 * 
 * Importing appPrisma here reuses the shared application singleton, ensuring that tests,
 * controllers, and background scripts (e.g. cleanup-sessions.ts) operate on the exact
 * same connection pool without creating duplicate Prisma clients.
 */
import { prisma as appPrisma } from '../../src/lib/prisma';

/**
 * Validates that the runtime PostgreSQL server address (inet_server_addr)
 * returned by PostgreSQL is strictly a local loopback interface (Fix 1).
 * - Accepts IPv4 loopback in 127.0.0.0/8 (e.g. '127.0.0.1', '127.0.0.1/32').
 * - Accepts IPv6 loopback '::1' (e.g. '::1', '::1/128').
 * - Handles NULL address deliberately: permitted only if the configured target host
 *   is an explicit Unix domain socket path (starts with '/' or '%2F'); otherwise fails closed.
 */
export function validateRuntimeServerAddress(
  serverAddr: string | null | undefined,
  configuredHost: string = 'localhost'
): boolean {
  if (serverAddr === null || serverAddr === undefined) {
    // In PostgreSQL, inet_server_addr() returns NULL for local Unix-domain socket connections.
    // We only permit NULL if the connection host is explicitly configured as a Unix socket path.
    const isUnixSocket =
      configuredHost.startsWith('/') ||
      configuredHost.startsWith('%2F') ||
      configuredHost.includes('.s.PGSQL');

    if (isUnixSocket) {
      return true;
    }

    throw new Error(
      'SAFETY ABORT: PostgreSQL server address is NULL, but connection configuration is not a Unix-domain socket. Failing closed.'
    );
  }

  // Strip CIDR netmask if returned by Postgres (e.g. "::1/128" -> "::1", "127.0.0.1/32" -> "127.0.0.1")
  const cleanAddr = serverAddr.split('/')[0].trim().toLowerCase();

  if (cleanAddr === '::1') {
    return true;
  }

  // IPv4 Loopback in 127.0.0.0/8 (127.0.0.0 to 127.255.255.255)
  if (isLoopbackIPv4(cleanAddr)) {
    return true;
  }

  throw new Error(
    `SAFETY ABORT: PostgreSQL server address '${cleanAddr}' is not a valid local loopback address (expected 127.0.0.0/8 or ::1).`
  );
}

/**
 * Returns a singleton or isolated PrismaClient instance that is guaranteed
 * to connect ONLY to the verified local test database (rentgoer_test).
 */
export function getTestPrismaClient(): {
  prisma: PrismaClient;
  target: SanitizedDbTarget;
} {
  const config = applyTestEnvironment();

  return {
    prisma: appPrisma,
    target: config.target,
  };
}

/**
 * Executes a runtime SQL database identity check against PostgreSQL.
 * Confirms current_database() is 'rentgoer_test' and server address is loopback before any test write or mutation.
 */
export async function assertTestDatabaseSafety(prisma: PrismaClient): Promise<{
  currentDatabase: string;
  serverAddr: string;
  currentUser: string;
}> {
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT current_database(), inet_server_addr()::text, current_user
    `;

    if (!rows || rows.length === 0) {
      throw new Error('FAIL-CLOSED DB GUARD: Database identity query returned no rows.');
    }

    const { current_database, inet_server_addr, current_user } = rows[0];

    // 1. Verify exact database name
    if (current_database !== 'rentgoer_test') {
      throw new Error(
        `SAFETY ABORT: Connected to database '${current_database}', expected 'rentgoer_test'! Aborting immediately.`
      );
    }

    // 2. Verify runtime server address is local loopback (Fix 1)
    validateRuntimeServerAddress(inet_server_addr);

    return {
      currentDatabase: current_database,
      serverAddr: inet_server_addr,
      currentUser: current_user,
    };
  } catch (err) {
    throw new Error(sanitizeErrorMessage(err));
  }
}

/**
 * Scoped fixture context that tracks all IDs created during test execution
 * and performs strict, targeted cleanup. Never uses unbounded deleteMany({}).
 */
export class ScopedTestContext {
  private prisma: PrismaClient;
  public userIds = new Set<string>();
  public propertyIds = new Set<string>();
  public conversationIds = new Set<string>();
  public rentalRequestIds = new Set<string>();
  public reviewIds = new Set<string>();
  public sessionIds = new Set<string>();
  public tokenHashes = new Set<string>();
  public notificationIds = new Set<string>();
  public reportIds = new Set<string>();
  public verificationRequestIds = new Set<string>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  trackUser(id: string) {
    if (id) this.userIds.add(id);
    return id;
  }

  trackProperty(id: string) {
    if (id) this.propertyIds.add(id);
    return id;
  }

  trackConversation(id: string) {
    if (id) this.conversationIds.add(id);
    return id;
  }

  trackRentalRequest(id: string) {
    if (id) this.rentalRequestIds.add(id);
    return id;
  }

  trackReview(id: string) {
    if (id) this.reviewIds.add(id);
    return id;
  }

  trackSession(id: string) {
    if (id) this.sessionIds.add(id);
    return id;
  }

  trackTokenHash(hash: string) {
    if (hash) this.tokenHashes.add(hash);
    return hash;
  }

  trackNotification(id: string) {
    if (id) this.notificationIds.add(id);
    return id;
  }

  trackReport(id: string) {
    if (id) this.reportIds.add(id);
    return id;
  }

  trackVerificationRequest(id: string) {
    if (id) this.verificationRequestIds.add(id);
    return id;
  }

  /**
   * Scoped cleanup: strictly deletes only the tracked entities created during tests
   * in reverse foreign-key dependency order.
   */
  async cleanup(): Promise<void> {
    // Re-verify database identity before any cleanup statement
    await assertTestDatabaseSafety(this.prisma);

    try {
      // 1. Messages in tracked conversations or by tracked users
      if (this.conversationIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.conversationIds.size > 0) {
          orClauses.push({ conversationId: { in: Array.from(this.conversationIds) } });
        }
        if (this.userIds.size > 0) {
          orClauses.push({ senderId: { in: Array.from(this.userIds) } });
        }
        await this.prisma.message.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 2. Conversations
      if (this.conversationIds.size > 0) {
        await this.prisma.conversation
          .deleteMany({ where: { id: { in: Array.from(this.conversationIds) } } })
          .catch(() => {});
      }

      // 3. Reviews
      if (this.reviewIds.size > 0 || this.rentalRequestIds.size > 0) {
        const orClauses: any[] = [];
        if (this.reviewIds.size > 0) orClauses.push({ id: { in: Array.from(this.reviewIds) } });
        if (this.rentalRequestIds.size > 0)
          orClauses.push({ rentalRequestId: { in: Array.from(this.rentalRequestIds) } });
        await this.prisma.review.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 4. Rental requests
      if (this.rentalRequestIds.size > 0 || this.userIds.size > 0 || this.propertyIds.size > 0) {
        const orClauses: any[] = [];
        if (this.rentalRequestIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.rentalRequestIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ tenantId: { in: Array.from(this.userIds) } });
        if (this.propertyIds.size > 0)
          orClauses.push({ propertyId: { in: Array.from(this.propertyIds) } });
        await this.prisma.rentalRequest.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 5. Property images
      if (this.propertyIds.size > 0) {
        await this.prisma.propertyImage
          .deleteMany({ where: { propertyId: { in: Array.from(this.propertyIds) } } })
          .catch(() => {});
      }

      // 6. Favorites
      if (this.propertyIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.propertyIds.size > 0)
          orClauses.push({ propertyId: { in: Array.from(this.propertyIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ userId: { in: Array.from(this.userIds) } });
        await this.prisma.favorite.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 7. Verification requests
      if (this.verificationRequestIds.size > 0 || this.userIds.size > 0 || this.propertyIds.size > 0) {
        const orClauses: any[] = [];
        if (this.verificationRequestIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.verificationRequestIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ ownerId: { in: Array.from(this.userIds) } });
        if (this.propertyIds.size > 0)
          orClauses.push({ propertyId: { in: Array.from(this.propertyIds) } });
        await this.prisma.verificationRequest.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 8. Properties
      if (this.propertyIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.propertyIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.propertyIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ ownerId: { in: Array.from(this.userIds) } });
        await this.prisma.property.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 9. Notifications
      if (this.notificationIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.notificationIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.notificationIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ userId: { in: Array.from(this.userIds) } });
        await this.prisma.notification.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 10. Reports
      if (this.reportIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.reportIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.reportIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ reporterId: { in: Array.from(this.userIds) } });
        await this.prisma.report.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 11. Sessions
      if (this.sessionIds.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.sessionIds.size > 0)
          orClauses.push({ id: { in: Array.from(this.sessionIds) } });
        if (this.userIds.size > 0)
          orClauses.push({ userId: { in: Array.from(this.userIds) } });
        await this.prisma.session.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 12. Revoked legacy tokens
      if (this.tokenHashes.size > 0 || this.userIds.size > 0) {
        const orClauses: any[] = [];
        if (this.tokenHashes.size > 0)
          orClauses.push({ tokenHash: { in: Array.from(this.tokenHashes) } });
        if (this.userIds.size > 0)
          orClauses.push({ userId: { in: Array.from(this.userIds) } });
        await this.prisma.revokedLegacyToken.deleteMany({ where: { OR: orClauses } }).catch(() => {});
      }

      // 13. Users
      if (this.userIds.size > 0) {
        await this.prisma.user
          .deleteMany({ where: { id: { in: Array.from(this.userIds) } } })
          .catch(() => {});
      }
    } catch (err) {
      console.error('ScopedTestContext cleanup error:', sanitizeErrorMessage(err));
    } finally {
      this.userIds.clear();
      this.propertyIds.clear();
      this.conversationIds.clear();
      this.rentalRequestIds.clear();
      this.reviewIds.clear();
      this.sessionIds.clear();
      this.tokenHashes.clear();
      this.notificationIds.clear();
      this.reportIds.clear();
      this.verificationRequestIds.clear();
    }
  }
}

/**
 * Disconnects the test Prisma client when integration suite completes.
 */
export async function teardownTestDatabase(): Promise<void> {
  await appPrisma.$disconnect();
}
