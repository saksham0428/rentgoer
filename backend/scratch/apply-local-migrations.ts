import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

console.log('======================================================================');
console.log('🔒 SAFE LOCAL MIGRATION RUNNER — LOCALHOST ONLY');
console.log('======================================================================\n');

const envPath = '.env.test.local';
if (!fs.existsSync(envPath)) {
  console.error('FATAL: .env.test.local not found!');
  process.exit(1);
}

const testEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

if (!testEnv.DATABASE_URL || !testEnv.DIRECT_URL) {
  console.error('FATAL: .env.test.local must define both DATABASE_URL and DIRECT_URL!');
  process.exit(1);
}

// 1. Strict URL validation
function validateLocalUrl(rawUrl: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    console.error(`FATAL: ${name} is an invalid URL: ${err.message}`);
    process.exit(1);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    console.error(`FATAL: ${name} protocol must be postgresql:, got: ${parsed.protocol}`);
    process.exit(1);
  }

  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    console.error(`SAFETY ABORT: ${name} hostname must be localhost or 127.0.0.1! Got: ${parsed.hostname}`);
    process.exit(1);
  }

  if (parsed.port !== '5432') {
    console.error(`SAFETY ABORT: ${name} port must be 5432! Got: ${parsed.port}`);
    process.exit(1);
  }

  if (parsed.pathname !== '/rentgoer_test') {
    console.error(`SAFETY ABORT: ${name} database must be rentgoer_test! Got: ${parsed.pathname}`);
    process.exit(1);
  }

  return parsed;
}

const dbUrlParsed = validateLocalUrl(testEnv.DATABASE_URL, 'DATABASE_URL');
const directUrlParsed = validateLocalUrl(testEnv.DIRECT_URL, 'DIRECT_URL');

console.log('✓ SAFETY VERIFIED: Destination is confirmed local PostgreSQL.');
console.log('  - Host:     %s', dbUrlParsed.hostname);
console.log('  - Port:     %s', dbUrlParsed.port);
console.log('  - Database: %s', dbUrlParsed.pathname.slice(1));
// 2. Pre-flight: Ensure mock roles exist in local PostgreSQL
async function preFlight() {
  const prisma = new PrismaClient({
    datasources: { db: { url: testEnv.DATABASE_URL } },
  });

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END
      $$;
    `);

    // Check if 20261008113906_chat_perms failed previously and needs resolving
    const failedMigrations: any[] = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `);

    for (const failed of failedMigrations) {
      console.log(`Resolving previously failed migration record: ${failed.migration_name} as rolled-back...`);
      const resolveResult = spawnSync('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', failed.migration_name], {
        env: {
          ...process.env,
          DATABASE_URL: testEnv.DATABASE_URL,
          DIRECT_URL: testEnv.DIRECT_URL,
        },
        encoding: 'utf8',
        shell: true,
      });
      if (resolveResult.stdout) console.log(resolveResult.stdout);
      if (resolveResult.stderr) console.error(resolveResult.stderr);
      if (resolveResult.status !== 0) {
        throw new Error(`Failed to resolve migration: ${failed.migration_name}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  await preFlight();

  console.log('\nExecuting "npx prisma migrate deploy" against local test database...\n');

  // Execute migration with clean, explicit environment
  const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL: testEnv.DATABASE_URL,
      DIRECT_URL: testEnv.DIRECT_URL,
    },
    encoding: 'utf8',
    shell: true,
  });

  if (migrateResult.stdout) {
    console.log(migrateResult.stdout);
  }
  if (migrateResult.stderr) {
    console.error(migrateResult.stderr);
  }

  if (migrateResult.status !== 0) {
    console.error(`\n❌ Migration failed with exit code: ${migrateResult.status}`);
    process.exit(migrateResult.status || 1);
  }

  console.log('✓ Migration command exited with code 0.\n');
}

// 3. Post-migration read-only verification
async function verifyTables() {
  console.log('Verifying applied tables and migration history in local rentgoer_test...');
  const prisma = new PrismaClient({
    datasources: { db: { url: testEnv.DATABASE_URL } },
  });

  try {
    const tables: any[] = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User', 'Session', 'RevokedLegacyToken') ORDER BY table_name"
    );
    console.log('Tables confirmed in public schema:');
    tables.forEach((t) => console.log('  ✓', t.table_name));

    if (tables.length !== 3) {
      throw new Error(`Expected User, Session, and RevokedLegacyToken tables. Found ${tables.length} tables.`);
    }

    const latestMigration: any[] = await prisma.$queryRawUnsafe(
      'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1'
    );
    console.log('\nLatest migration recorded in _prisma_migrations:');
    console.log('  ✓ %s (finished at: %s)', latestMigration[0].migration_name, latestMigration[0].finished_at);
  } finally {
    await prisma.$disconnect();
  }
}

run()
  .then(() => verifyTables())
  .then(() => {
    console.log('\n🎉 LOCAL MIGRATION COMPLETE & VERIFIED SUCCESSFULLY! 🎉\n');
  })
  .catch((err) => {
    console.error('Migration / Verification failed:', err.message);
    process.exit(1);
  });
