/**
 * Fail-Closed Backend URL Validation for RentGoer (SEC-03).
 *
 * Guarantees that when the application runs in test / E2E mode,
 * all server-side requests (Next.js rewrites and server component fetches)
 * strictly target the isolated local test backend on port 5001,
 * and cannot silently fall back to port 5000 or contact remote/production services.
 */

const STRICT_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Validates that a raw backend URL strictly targets the isolated test backend on port 5001.
 * Throws a descriptive, fail-closed error if any condition fails.
 */
export function validateTestBackendUrl(rawUrl: string | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(
      'FAIL-CLOSED TEST GUARD: NEXT_PUBLIC_BACKEND_URL is required under test mode but was not provided. ' +
        'Expected local loopback on isolated test port 5001 (e.g. http://127.0.0.1:5001).'
    );
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `FAIL-CLOSED TEST GUARD: NEXT_PUBLIC_BACKEND_URL '${trimmed}' is malformed and could not be parsed as a valid URL.`
    );
  }

  // 1. Protocol check: Test backend must use plaintext HTTP on local loopback
  if (parsed.protocol !== 'http:') {
    throw new Error(
      `FAIL-CLOSED TEST GUARD: Invalid protocol '${parsed.protocol}' for test backend. Expected 'http:'. Remote HTTPS endpoints are strictly prohibited in tests.`
    );
  }

  // 2. Host check: Must be strict local loopback
  const hostname = parsed.hostname.toLowerCase();
  if (!STRICT_LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `FAIL-CLOSED TEST GUARD: Forbidden test backend host '${hostname}'. E2E tests are strictly confined to local loopback (127.0.0.1 / localhost). Production, staging, and remote domains are prohibited.`
    );
  }

  // 3. Port check: Must be isolated test port 5001, strictly rejecting dev port 5000
  const port = parsed.port || '80';
  if (port !== '5001') {
    throw new Error(
      `FAIL-CLOSED TEST GUARD: Invalid test backend port '${port}'. E2E tests must target isolated test port 5001. Development port 5000 and arbitrary ports are rejected.`
    );
  }

  // Return normalized origin without trailing slashes
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Resolves the backend base URL safely based on execution mode.
 * - Under test mode (RENTGOER_TEST_MODE='true'): strictly enforces loopback port 5001.
 * - Outside test mode (dev / production): preserves existing behavior and standard fallbacks.
 */
export function getSafeBackendUrl(options?: {
  rawUrl?: string;
  isTestMode?: boolean;
}): string {
  const isTest =
    options?.isTestMode ??
    (process.env.RENTGOER_TEST_MODE === 'true');

  const raw =
    options?.rawUrl ??
    (isTest
      ? (process.env.TEST_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL)
      : process.env.NEXT_PUBLIC_BACKEND_URL);

  if (isTest) {
    return validateTestBackendUrl(raw);
  }

  // Standard development / production fallback
  return raw && raw.trim() ? raw.trim() : 'http://localhost:5000';
}
