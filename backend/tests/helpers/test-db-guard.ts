import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export interface SanitizedDbTarget {
  isLocal: boolean;
  hostname: string;
  port: string;
  database: string;
  sanitizedDisplay: string;
}

/**
 * Known cloud and remote database host substrings that must be strictly rejected
 * for integration test execution.
 */
const FORBIDDEN_CLOUD_DOMAINS = [
  'supabase.com',
  'supabase.co',
  'render.com',
  'railway.app',
  'railway.internal',
  'neon.tech',
  'amazonaws.com',
  'aws.',
  'azure.com',
  'cloud.google.com',
  'pooler.supabase.com',
];

/**
 * Strictly recognized local loopback hostnames and IPv4/IPv6 loopbacks.
 */
const STRICT_LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Strictly verifies whether an IPv4 address is in 127.0.0.0/8 (127.0.0.0 to 127.255.255.255)
 */
export function isLoopbackIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  if (parts[0] !== '127') return false;
  for (let i = 1; i < 4; i++) {
    const num = Number(parts[i]);
    if (isNaN(num) || num < 0 || num > 255 || parts[i] !== String(num)) {
      return false;
    }
  }
  return true;
}

/**
 * Strictly verifies whether a hostname represents a valid loopback address:
 * - 'localhost'
 * - IPv4 in 127.0.0.0/8 (127.0.0.1 through 127.255.255.255)
 * - IPv6 '::1' or '[::1]'
 * Rejects domain names such as '127.example.com' or other non-loopback addresses.
 */
export function isStrictLoopbackHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }
  const normalized = hostname.toLowerCase().trim();

  if (normalized === 'localhost' || normalized === '::1' || normalized === '[::1]') {
    return true;
  }

  return isLoopbackIPv4(normalized);
}

/**
 * Parses a database connection URL and scrubs all sensitive credentials (user, password, tokens).
 * Never exposes credentials in return values, displays, or thrown errors.
 */
export function sanitizeDatabaseUrl(rawUrl: string): SanitizedDbTarget {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('FAIL-CLOSED DB GUARD: Connection URL is malformed and could not be parsed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const database = parsed.pathname.replace(/^\//, '').split('?')[0];

  const isLocalLoopback = isStrictLoopbackHost(hostname);
  const isCloudHost = FORBIDDEN_CLOUD_DOMAINS.some((domain) => hostname.includes(domain));
  const isLocal = isLocalLoopback && !isCloudHost;

  const protocol = parsed.protocol || 'postgresql:';
  const sanitizedDisplay = `${protocol}//***:***@${hostname}:${port}/${database}`;

  return {
    isLocal,
    hostname,
    port,
    database,
    sanitizedDisplay,
  };
}

/**
 * Validates that a raw database URL targets a verified local PostgreSQL test database.
 * Throws a descriptive, fail-closed error without leaking credentials if any safety check fails.
 */
export function validateTestDatabaseUrl(
  rawUrl: string,
  expectedDbName: string = 'rentgoer_test'
): SanitizedDbTarget {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('FAIL-CLOSED DB GUARD: Database connection URL is missing or empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('FAIL-CLOSED DB GUARD: Invalid database connection URL format.');
  }

  // 1. Protocol check
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `FAIL-CLOSED DB GUARD: Invalid protocol '${parsed.protocol}'. Expected 'postgresql:' or 'postgres:'.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Immediate rejection of known cloud database hosts
  for (const cloudDomain of FORBIDDEN_CLOUD_DOMAINS) {
    if (hostname.includes(cloudDomain)) {
      throw new Error(
        `SAFETY ABORT: Cloud database host detected ('${hostname}'). Integration tests must NEVER connect to remote services like Supabase or Render!`
      );
    }
  }

  // 3. Strict local loopback enforcement
  if (!isStrictLoopbackHost(hostname)) {
    throw new Error(
      `SAFETY ABORT: Destination host '${hostname}' is not a local loopback. Integration tests are strictly confined to localhost / 127.0.0.1.`
    );
  }

  // 4. Database name check
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (dbName !== expectedDbName) {
    throw new Error(
      `SAFETY ABORT: Destination database is '${dbName}', expected '${expectedDbName}'. Integration tests will not run against non-test databases!`
    );
  }

  return sanitizeDatabaseUrl(rawUrl);
}

/**
 * Loads and validates a dedicated test environment configuration file (e.g. .env.test.local).
 * Never falls back to default .env or ambient process.env.DATABASE_URL.
 */
export function loadAndValidateTestEnvironment(envFilePath?: string): {
  databaseUrl: string;
  directUrl?: string;
  target: SanitizedDbTarget;
} {
  const targetPath = envFilePath || path.resolve(__dirname, '../../.env.test.local');

  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `FAIL-CLOSED DB GUARD: Test environment file '${path.basename(targetPath)}' was not found. ` +
        `Create 'backend/.env.test.local' with a dedicated local PostgreSQL configuration (e.g. localhost:5432/rentgoer_test). ` +
        `Never fall back to production .env!`
    );
  }

  const fileContent = fs.readFileSync(targetPath, 'utf8');
  const parsedEnv = dotenv.parse(fileContent);

  if (!parsedEnv.DATABASE_URL) {
    throw new Error(
      `FAIL-CLOSED DB GUARD: 'DATABASE_URL' is missing from '${path.basename(targetPath)}'. ` +
        `Explicit test database configuration is required.`
    );
  }

  const target = validateTestDatabaseUrl(parsedEnv.DATABASE_URL, 'rentgoer_test');

  if (parsedEnv.DIRECT_URL) {
    validateTestDatabaseUrl(parsedEnv.DIRECT_URL, 'rentgoer_test');
  }

  return {
    databaseUrl: parsedEnv.DATABASE_URL,
    directUrl: parsedEnv.DIRECT_URL,
    target,
  };
}

/**
 * Sanitizes any error message to ensure credentials, passwords, or connection URIs
 * are completely masked before being logged or thrown.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2')
    .replace(/(postgres(?:ql)?:\/\/)[^@]+(@)/gi, '$1***:***$2');
}

/**
 * Safely applies validated test environment variables to process.env.
 * Throws fail-closed if validation fails, and guarantees no cloud/production URLs are used.
 */
export function applyTestEnvironment(envFilePath?: string): {
  databaseUrl: string;
  directUrl?: string;
  target: SanitizedDbTarget;
} {
  const config = loadAndValidateTestEnvironment(envFilePath);
  process.env.DATABASE_URL = config.databaseUrl;
  if (config.directUrl) {
    process.env.DIRECT_URL = config.directUrl;
  }
  process.env.NODE_ENV = 'test';
  return config;
}

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


