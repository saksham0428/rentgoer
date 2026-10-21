/**
 * Authentication Sessions & Legacy Revocation Cleanup Script
 *
 * Removes expired records from Session and RevokedLegacyToken tables.
 * Safe to run as a scheduled Render cron job or invoked manually.
 */

import { prisma } from '../lib/prisma';

export async function cleanupExpiredAuthRecords(): Promise<{
  deletedSessions: number;
  deletedRevokedTokens: number;
}> {
  const now = new Date();
  console.log(`[Auth Cleanup] Starting session and revocation cleanup at ${now.toISOString()}...`);

  // Delete expired sessions (where expiresAt < now)
  const sessionResult = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  // Delete expired legacy revocation records (where expiresAt < now)
  const legacyResult = await prisma.revokedLegacyToken.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  console.log(`[Auth Cleanup] Deleted ${sessionResult.count} expired sessions.`);
  console.log(`[Auth Cleanup] Deleted ${legacyResult.count} expired legacy revocation records.`);

  return {
    deletedSessions: sessionResult.count,
    deletedRevokedTokens: legacyResult.count,
  };
}

if (require.main === module) {
  cleanupExpiredAuthRecords()
    .then(() => {
      console.log('[Auth Cleanup] Cleanup completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Auth Cleanup] Error during cleanup execution:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
