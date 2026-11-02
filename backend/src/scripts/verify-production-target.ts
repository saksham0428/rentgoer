import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

export const EXPECTED_PRODUCTION_PROJECT_REF = 'qgqwrxttgdnconrqfspb';
export const FORBIDDEN_STAGING_PROJECT_REF = 'miapwrcydpwmaiixygdo';
export const EXPECTED_REGION = 'ap-south-1';
export const EXPECTED_DATABASE = 'postgres';
export const FORBIDDEN_LOCAL_DATABASES = ['rentgoer_dev', 'rentgoer_test'];
export const FORBIDDEN_LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

export interface ProductionVerificationResult {
  verified: boolean;
  projectRef: string;
  region: string;
  directHost: string;
  directPort: string;
  poolerHost: string;
  poolerPort: string;
  currentDatabase: string;
  currentUser: string;
  serverIp: string;
  existingPublicTables: string[];
  appliedMigrations: string[];
  pendingMigrations: string[];
  renterProfileColumns: Array<{ column_name: string; data_type: string; is_nullable: string }>;
  rlsStatus: Array<{ table_name: string; rls_enabled: boolean }>;
}

/**
 * Loads production environment from backend/.env if present.
 */
export function loadProductionEnv(envFilePath?: string): dotenv.DotenvParseOutput {
  const targetPath = envFilePath || path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(targetPath)) {
    throw new Error(`FAIL-CLOSED PRODUCTION GUARD: Production env file not found at: ${targetPath}`);
  }
  const parsed = dotenv.parse(fs.readFileSync(targetPath, 'utf8'));

  // Explicitly assign/override to prevent falling back to defaults
  process.env.DIRECT_URL = parsed.DIRECT_URL || '';
  process.env.DATABASE_URL = parsed.DATABASE_URL || '';
  if (parsed.SUPABASE_URL) process.env.SUPABASE_URL = parsed.SUPABASE_URL;
  if (parsed.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = parsed.SUPABASE_SERVICE_ROLE_KEY;
  if (parsed.SUPABASE_STORAGE_BUCKET) process.env.SUPABASE_STORAGE_BUCKET = parsed.SUPABASE_STORAGE_BUCKET;

  if (!parsed.DIRECT_URL || !parsed.DIRECT_URL.trim()) {
    throw new Error('FAIL-CLOSED PRODUCTION GUARD: DIRECT_URL is empty in production environment.');
  }
  if (!parsed.DATABASE_URL || !parsed.DATABASE_URL.trim()) {
    throw new Error('FAIL-CLOSED PRODUCTION GUARD: DATABASE_URL is empty in production environment.');
  }

  return parsed;
}

/**
 * Positively verifies that a connection URL strictly targets the production Supabase project in ap-south-1.
 */
export function parseAndValidateProductionUrl(
  rawUrl: string | undefined,
  variableName: 'DIRECT_URL' | 'DATABASE_URL'
): {
  hostname: string;
  port: string;
  pathname: string;
  username: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(`FAIL-CLOSED PRODUCTION GUARD: ${variableName} is not set or empty in production environment.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`FAIL-CLOSED PRODUCTION GUARD: ${variableName} is malformed and could not be parsed.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const pathname = parsed.pathname.replace(/^\//, '').split('?')[0];
  const username = decodeURIComponent(parsed.username || '').toLowerCase();

  // 1. Staging Reference Rejection (Strict Blacklist)
  if (
    hostname.includes(FORBIDDEN_STAGING_PROJECT_REF) ||
    username.includes(FORBIDDEN_STAGING_PROJECT_REF)
  ) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Staging project reference '${FORBIDDEN_STAGING_PROJECT_REF}' ` +
      `detected in ${variableName}! Production must strictly target '${EXPECTED_PRODUCTION_PROJECT_REF}'.`
    );
  }

  // 2. Loopback and Local Database Rejection
  if (FORBIDDEN_LOOPBACK_HOSTS.includes(hostname)) {
    throw new Error(
      `SAFETY ABORT: ${variableName} specifies loopback host '${hostname}'. ` +
      `Production migrations must strictly target the hosted production project.`
    );
  }
  if (FORBIDDEN_LOCAL_DATABASES.includes(pathname)) {
    throw new Error(
      `SAFETY ABORT: ${variableName} specifies local database '${pathname}'. ` +
      `Production migrations cannot run on local development databases.`
    );
  }

  // 3. Positive Project Reference Verification
  const containsPositiveRef =
    hostname.includes(EXPECTED_PRODUCTION_PROJECT_REF) ||
    username.includes(EXPECTED_PRODUCTION_PROJECT_REF);

  if (!containsPositiveRef) {
    throw new Error(
      `CRITICAL SAFETY ABORT: ${variableName} does not contain expected production project reference ` +
      `'${EXPECTED_PRODUCTION_PROJECT_REF}' in hostname or username. Target identity mismatch.`
    );
  }

  // 4. Region Verification (ap-south-1)
  if (!hostname.includes(EXPECTED_REGION)) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Host '${hostname}' does not match expected production region '${EXPECTED_REGION}'.`
    );
  }

  // 5. Database Name Verification
  if (pathname !== EXPECTED_DATABASE) {
    throw new Error(
      `SAFETY ABORT: ${variableName} database is '${pathname}', expected '${EXPECTED_DATABASE}'.`
    );
  }

  // 6. Port Validation for DIRECT_URL vs DATABASE_URL
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
 * Performs positive pre-flight verification against the live production database in read-only mode.
 * Zero mutations, zero DDL, zero data changes.
 */
export async function verifyProductionTarget(envFilePath?: string): Promise<ProductionVerificationResult> {
  loadProductionEnv(envFilePath);

  const directInfo = parseAndValidateProductionUrl(process.env.DIRECT_URL, 'DIRECT_URL');
  const poolerInfo = parseAndValidateProductionUrl(process.env.DATABASE_URL, 'DATABASE_URL');

  // Verify live connection using PrismaClient against DIRECT_URL in read-only mode
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
      throw new Error('FAIL-CLOSED PRODUCTION GUARD: Database handshake query returned no results.');
    }

    const { db, usr, ip } = handshakeRows[0];

    if (db !== EXPECTED_DATABASE) {
      throw new Error(`FAIL-CLOSED PRODUCTION GUARD: Connected database is '${db}', expected '${EXPECTED_DATABASE}'.`);
    }

    // Check existing tables in public schema
    const tableRows = await prismaDirect.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const existingPublicTables = tableRows.map((r) => r.table_name);

    // Read applied migrations from _prisma_migrations
    const migrationRows = await prismaDirect.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL
      ORDER BY finished_at ASC
    `;

    const appliedMigrations = migrationRows.map((m) => m.migration_name);

    // List all expected migrations in local migrations folder
    const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
    const localMigrationDirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const pendingMigrations = localMigrationDirs.filter((m) => !appliedMigrations.includes(m));

    // Check renter profile columns
    let renterProfileColumns: Array<{ column_name: string; data_type: string; is_nullable: string }> = [];
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

    // Check RLS status across public tables
    const rlsRows = await prismaDirect.$queryRaw<
      Array<{ table_name: string; rls_enabled: boolean }>
    >`
      SELECT c.relname as table_name, c.relrowsecurity as rls_enabled 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE n.nspname = 'public' AND c.relkind = 'r' 
      ORDER BY c.relname
    `;

    return {
      verified: true,
      projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
      region: EXPECTED_REGION,
      directHost: directInfo.hostname,
      directPort: directInfo.port,
      poolerHost: poolerInfo.hostname,
      poolerPort: poolerInfo.port,
      currentDatabase: db,
      currentUser: usr,
      serverIp: ip || 'remote-cloud',
      existingPublicTables,
      appliedMigrations,
      pendingMigrations,
      renterProfileColumns,
      rlsStatus: rlsRows,
    };
  } finally {
    await prismaDirect.$disconnect();
  }
}

if (require.main === module) {
  verifyProductionTarget()
    .then((res) => {
      console.log('----------------------------------------------------');
      console.log('[PRODUCTION GUARD] Target Verification Result:');
      console.log(`- Project Reference   : ${res.projectRef} (MATCH)`);
      console.log(`- Region              : ${res.region} (MATCH)`);
      console.log(`- Direct Host / Port  : ${res.directHost}:${res.directPort}`);
      console.log(`- Pooler Host / Port  : ${res.poolerHost}:${res.poolerPort}`);
      console.log(`- Connected Database  : ${res.currentDatabase}`);
      console.log(`- Connected User      : ${res.currentUser}`);
      console.log(`- Public Tables       : ${res.existingPublicTables.length} tables`);
      console.log(`- Applied Migrations  : ${res.appliedMigrations.length} applied`);
      console.log(`- Pending Migrations  : ${res.pendingMigrations.length} pending (${res.pendingMigrations.join(', ') || 'None'})`);
      console.log(`- Renter Profile Cols : ${res.renterProfileColumns.length} present (${res.renterProfileColumns.map(c => c.column_name).join(', ') || 'None'})`);
      const unencryptedRls = res.rlsStatus.filter(r => !r.rls_enabled).map(r => r.table_name);
      console.log(`- Tables Without RLS  : ${unencryptedRls.length} tables (${unencryptedRls.join(', ') || 'All Protected'})`);
      console.log('----------------------------------------------------');
      process.exit(0);
    })
    .catch((err) => {
      console.error('----------------------------------------------------');
      console.error('[PRODUCTION GUARD] Verification FAILED:');
      console.error(err.message);
      console.error('----------------------------------------------------');
      process.exit(1);
    });
}

