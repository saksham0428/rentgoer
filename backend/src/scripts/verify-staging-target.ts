import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

export const EXPECTED_STAGING_PROJECT_REF = 'miapwrcydpwmaiixygdo';
export const FORBIDDEN_PRODUCTION_PROJECT_REF = 'qgqwrxttgdnconrqfspb';
export const FORBIDDEN_LOCAL_DATABASES = ['rentgoer_dev', 'rentgoer_test'];
export const FORBIDDEN_LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

export interface VerificationResult {
  verified: boolean;
  projectRef: string;
  directHost: string;
  directPort: string;
  poolerHost: string;
  poolerPort: string;
  currentDatabase: string;
  currentUser: string;
  serverIp: string;
  existingPublicTables: string[];
  isInitialEmptyState: boolean;
  renterProfileColumns?: Array<{ column_name: string; data_type: string; is_nullable: string }>;
}

/**
 * Loads staging environment from backend/.env.staging.local if present.
 */
export function loadStagingEnv(envFilePath?: string): dotenv.DotenvParseOutput {
  const targetPath = envFilePath || path.resolve(__dirname, '../../.env.staging.local');
  if (!fs.existsSync(targetPath)) {
    throw new Error(`FAIL-CLOSED STAGING GUARD: Staging env file not found at: ${targetPath}`);
  }
  const parsed = dotenv.parse(fs.readFileSync(targetPath, 'utf8'));
  
  // Explicitly assign/override to prevent falling back to base .env
  process.env.DIRECT_URL = parsed.DIRECT_URL || '';
  process.env.DATABASE_URL = parsed.DATABASE_URL || '';
  if (parsed.SUPABASE_URL) process.env.SUPABASE_URL = parsed.SUPABASE_URL;
  if (parsed.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = parsed.SUPABASE_SERVICE_ROLE_KEY;
  if (parsed.SUPABASE_STORAGE_BUCKET) process.env.SUPABASE_STORAGE_BUCKET = parsed.SUPABASE_STORAGE_BUCKET;

  if (!parsed.DIRECT_URL || !parsed.DIRECT_URL.trim()) {
    throw new Error('FAIL-CLOSED STAGING GUARD: DIRECT_URL is empty in backend/.env.staging.local.');
  }
  if (!parsed.DATABASE_URL || !parsed.DATABASE_URL.trim()) {
    throw new Error('FAIL-CLOSED STAGING GUARD: DATABASE_URL is empty in backend/.env.staging.local.');
  }

  return parsed;
}

/**
 * Positively verifies that a connection URL strictly targets the staging Supabase project.
 */
export function parseAndValidateStagingUrl(
  rawUrl: string | undefined,
  variableName: 'DIRECT_URL' | 'DATABASE_URL'
): {
  hostname: string;
  port: string;
  pathname: string;
  username: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(`FAIL-CLOSED STAGING GUARD: ${variableName} is not set or empty in staging environment.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`FAIL-CLOSED STAGING GUARD: ${variableName} is malformed and could not be parsed.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const pathname = parsed.pathname.replace(/^\//, '').split('?')[0];
  const username = decodeURIComponent(parsed.username || '').toLowerCase();

  // 1. Production Reference Rejection (Strict Blacklist)
  if (
    hostname.includes(FORBIDDEN_PRODUCTION_PROJECT_REF) ||
    username.includes(FORBIDDEN_PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Production project reference '${FORBIDDEN_PRODUCTION_PROJECT_REF}' ` +
      `detected in ${variableName}! Connecting to production is strictly forbidden.`
    );
  }

  // 2. Loopback and Local Database Rejection
  if (FORBIDDEN_LOOPBACK_HOSTS.includes(hostname)) {
    throw new Error(
      `SAFETY ABORT: ${variableName} specifies loopback host '${hostname}'. ` +
      `Staging migrations must strictly target the hosted staging project.`
    );
  }
  if (FORBIDDEN_LOCAL_DATABASES.includes(pathname)) {
    throw new Error(
      `SAFETY ABORT: ${variableName} specifies local database '${pathname}'. ` +
      `Staging migrations cannot target local development or test databases.`
    );
  }

  // 3. Positive Project Reference Identification
  const hasStagingRef =
    hostname.includes(EXPECTED_STAGING_PROJECT_REF) ||
    username.includes(EXPECTED_STAGING_PROJECT_REF);

  if (!hasStagingRef) {
    throw new Error(
      `POSITIVE IDENTITY FAILURE: ${variableName} does not contain expected staging project reference ` +
      `'${EXPECTED_STAGING_PROJECT_REF}'. Hostname: '${hostname}'. Aborting on identity mismatch.`
    );
  }

  // 4. Port Validation for DIRECT_URL vs DATABASE_URL
  if (variableName === 'DIRECT_URL' && port === '6543') {
    throw new Error(
      `CONFIGURATION ABORT: DIRECT_URL is configured on port 6543 (transaction pooler). ` +
      `Prisma migrations require a direct connection on port 5432 (native direct or session pooler) ` +
      `to support session-level advisory locks.`
    );
  }

  return { hostname, port, pathname, username };
}

/**
 * Performs positive pre-flight verification against the live staging database.
 */
export async function verifyStagingTarget(envFilePath?: string): Promise<VerificationResult> {
  loadStagingEnv(envFilePath);

  const directInfo = parseAndValidateStagingUrl(process.env.DIRECT_URL, 'DIRECT_URL');
  const poolerInfo = parseAndValidateStagingUrl(process.env.DATABASE_URL, 'DATABASE_URL');

  // Verify live connection using PrismaClient against DIRECT_URL
  const prismaDirect = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL,
      },
    },
  });

  try {
    const handshakeRows = await prismaDirect.$queryRaw<
      Array<{ db: string; usr: string; ip: string | null }>
    >`SELECT current_database() as db, current_user as usr, inet_server_addr()::text as ip`;

    if (!handshakeRows || handshakeRows.length === 0) {
      throw new Error('FAIL-CLOSED STAGING GUARD: Database handshake query returned no results.');
    }

    const { db, usr, ip } = handshakeRows[0];

    // Check existing tables in public schema
    const tableRows = await prismaDirect.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const existingPublicTables = tableRows.map((r) => r.table_name);
    const hasAppTables = existingPublicTables.some((t) =>
      ['User', 'Property', 'RentalRequest', 'Conversation', 'Message', 'Session'].includes(t)
    );

    const isInitialEmptyState = !hasAppTables && !existingPublicTables.includes('_prisma_migrations');

    let renterProfileColumns: Array<{ column_name: string; data_type: string; is_nullable: string }> | undefined;
    if (existingPublicTables.includes('User')) {
      renterProfileColumns = await prismaDirect.$queryRaw<
        Array<{ column_name: string; data_type: string; is_nullable: string }>
      >`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'User' 
          AND column_name IN ('bio', 'preferredCity', 'monthlyBudget', 'moveInTimeline')
        ORDER BY column_name
      `;
    }

    return {
      verified: true,
      projectRef: EXPECTED_STAGING_PROJECT_REF,
      directHost: directInfo.hostname,
      directPort: directInfo.port,
      poolerHost: poolerInfo.hostname,
      poolerPort: poolerInfo.port,
      currentDatabase: db,
      currentUser: usr,
      serverIp: ip || 'remote-cloud',
      existingPublicTables,
      isInitialEmptyState,
      renterProfileColumns,
    };
  } finally {
    await prismaDirect.$disconnect();
  }
}

if (require.main === module) {
  verifyStagingTarget()
    .then((res) => {
      console.log('----------------------------------------------------');
      console.log('[STAGING GUARD] Positive Target Verification PASSED:');
      console.log(`- Project Reference   : ${res.projectRef}`);
      console.log(`- Direct Host / Port  : ${res.directHost}:${res.directPort}`);
      console.log(`- Pooler Host / Port  : ${res.poolerHost}:${res.poolerPort}`);
      console.log(`- Connected Database  : ${res.currentDatabase}`);
      console.log(`- Connected User      : ${res.currentUser}`);
      console.log(`- Public Schema State : ${res.isInitialEmptyState ? 'Empty (Ready for initial migration)' : `${res.existingPublicTables.length} tables present`}`);
      if (res.existingPublicTables.length > 0) {
        console.log(`- Tables Detected     : ${res.existingPublicTables.join(', ')}`);
      }
      if (res.renterProfileColumns && res.renterProfileColumns.length > 0) {
        console.log('- Verified Profile Columns in User table:');
        res.renterProfileColumns.forEach((c) => {
          console.log(`  * ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
        });
      }
      console.log('----------------------------------------------------');
      process.exit(0);
    })
    .catch((err) => {
      console.error('----------------------------------------------------');
      console.error('[STAGING GUARD] Verification FAILED:');
      console.error(err.message);
      console.error('----------------------------------------------------');
      process.exit(1);
    });
}
