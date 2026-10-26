import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Known remote and cloud host identifiers that must NEVER be targeted during local development.
 */
const FORBIDDEN_CLOUD_DOMAINS = [
  'supabase.com',
  'supabase.co',
  'pooler.supabase.com',
  'render.com',
  'railway.app',
  'railway.internal',
  'neon.tech',
  'amazonaws.com',
  'aws.',
  'azure.com',
  'cloud.google.com',
];

/**
 * Enforces strict local PostgreSQL database isolation for development.
 *
 * 1. Automatically loads `backend/.env.development.local` if present.
 * 2. Overrides `DATABASE_URL` and `DIRECT_URL` so that local development
 *    strictly targets the local `rentgoer_dev` database on 127.0.0.1:5432.
 * 3. Loads base `.env` for other variables (JWT_SECRET, FRONTEND_URL, etc.)
 *    WITHOUT overriding the local database connection.
 * 4. Fails closed immediately if any cloud or non-loopback host is detected,
 *    or if the effective database name is anything other than `rentgoer_dev`.
 * 5. Disables production storage write operations in local development.
 */
export function applyDevEnvironment(envFilePath?: string | false): void {
  // If running in test mode and not explicitly testing dev-db-guard (envFilePath is undefined), do not interfere
  if (process.env.NODE_ENV === 'test' && envFilePath === undefined) {
    return;
  }

  // If running explicitly in production (e.g. Render), skip local development guard
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (envFilePath !== false) {
    const targetEnvPath = envFilePath || path.resolve(__dirname, '../../.env.development.local');
    if (fs.existsSync(targetEnvPath)) {
      const devParsed = dotenv.parse(fs.readFileSync(targetEnvPath, 'utf8'));
      if (devParsed.DATABASE_URL) {
        process.env.DATABASE_URL = devParsed.DATABASE_URL;
      }
      if (devParsed.DIRECT_URL) {
        process.env.DIRECT_URL = devParsed.DIRECT_URL;
      }
      if (devParsed.PORT) {
        process.env.PORT = devParsed.PORT;
      }
      if (devParsed.DISABLE_PRODUCTION_STORAGE_WRITES) {
        process.env.DISABLE_PRODUCTION_STORAGE_WRITES = devParsed.DISABLE_PRODUCTION_STORAGE_WRITES;
      }
    }
  }

  // Load base .env for non-database variables (JWT_SECRET, FRONTEND_URL, etc.)
  const baseEnvPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(baseEnvPath)) {
    const baseParsed = dotenv.parse(fs.readFileSync(baseEnvPath, 'utf8'));
    for (const [key, value] of Object.entries(baseParsed)) {
      if (key !== 'DATABASE_URL' && key !== 'DIRECT_URL' && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  // Fail-closed validation
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('FAIL-CLOSED DEV GUARD: DATABASE_URL is not configured.');
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error('FAIL-CLOSED DEV GUARD: Malformed DATABASE_URL format.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject known cloud domains
  for (const domain of FORBIDDEN_CLOUD_DOMAINS) {
    if (hostname.includes(domain)) {
      throw new Error(
        `SAFETY ABORT: Cloud database host '${hostname}' detected in local development! ` +
        `Local development must NEVER connect to remote services like Supabase or Render.`
      );
    }
  }

  // Require strict loopback
  const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
  if (!isLoopback) {
    throw new Error(
      `SAFETY ABORT: Host '${hostname}' is not a local loopback. ` +
      `Local development is strictly confined to localhost / 127.0.0.1.`
    );
  }

  // Require database name to be exactly rentgoer_dev
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (dbName !== 'rentgoer_dev') {
    throw new Error(
      `SAFETY ABORT: Target database is '${dbName}', expected 'rentgoer_dev'! ` +
      `Local development must strictly use rentgoer_dev to prevent touching test or production databases.`
    );
  }

  // Default port to 5000 for regular development backend
  if (!process.env.PORT) {
    process.env.PORT = '5000';
  }

  // Safeguard: disable write operations to production storage in local dev
  process.env.DISABLE_PRODUCTION_STORAGE_WRITES = 'true';

  console.log(
    `[DEV-BACKEND] Local database safety verified: database="${dbName}", host="${hostname}:${parsed.port || 5432}", port=${process.env.PORT}.`
  );
}
