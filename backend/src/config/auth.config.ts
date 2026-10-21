/**
 * Authentication & Session Configuration
 *
 * Strict configuration validation for JWT, multi-device sessions, and legacy token transition.
 */

export interface AuthConfig {
  legacyCutoffDate: Date;
  jwtSecret: string;
  enableSessionIssuance: boolean;
}

/**
 * Returns whether new logins/registrations/email-changes should issue session-aware JWTs.
 * Controls the two-stage rollout:
 *   Stage A (false): Code validates sessions if present, but continues issuing legacy tokens
 *                    so rolling deployments do not expose old instances to session-aware tokens.
 *   Stage B (true):  Activated only after 100% of running instances run compatible code.
 *                    All newly issued tokens contain unique sessionId claims.
 */
export const isSessionIssuanceEnabled = (): boolean => {
  const flag = process.env.ENABLE_SESSION_ISSUANCE;

  if (flag === undefined || flag === null || flag === '') {
    // Default to false for Stage A rollout safety unless explicitly activated
    return false;
  }

  const normalized = flag.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new Error(
    `FATAL CONFIGURATION ERROR: ENABLE_SESSION_ISSUANCE has invalid value "${flag}". ` +
    'Expected "true" or "false".'
  );
};

/**
 * Parses and validates the configured legacy token cutoff timestamp.
 * Throws a fatal configuration error if LEGACY_TOKEN_CUTOFF_DATE is missing or invalid.
 */
export const getLegacyCutoffDate = (): Date => {
  const rawCutoff = process.env.LEGACY_TOKEN_CUTOFF_DATE;

  if (!rawCutoff || typeof rawCutoff !== 'string' || !rawCutoff.trim()) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: LEGACY_TOKEN_CUTOFF_DATE environment variable is missing. ' +
      'An explicit ISO-8601 UTC timestamp must be configured (e.g., LEGACY_TOKEN_CUTOFF_DATE="2026-10-28T00:00:00.000Z") ' +
      'to define the immutable sunset boundary for legacy tokens without a sessionId.'
    );
  }

  const trimmed = rawCutoff.trim();
  const parsed = new Date(trimmed);

  if (isNaN(parsed.getTime())) {
    throw new Error(
      `FATAL CONFIGURATION ERROR: LEGACY_TOKEN_CUTOFF_DATE is invalid: "${rawCutoff}". ` +
      'It must be a valid ISO-8601 UTC timestamp (e.g., "2026-10-28T00:00:00.000Z").'
    );
  }

  return parsed;
};

/**
 * Validates mandatory authentication environment variables at application startup.
 * Called during bootstrap in backend/src/index.ts to ensure fast failure on misconfiguration.
 */
export const validateAuthConfigAtStartup = (): void => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is not configured.');
  }

  // Validate cutoff date format and presence
  const cutoff = getLegacyCutoffDate();

  // Validate rollout flag syntax
  const sessionEnabled = isSessionIssuanceEnabled();

  // Guard against dangerous misconfiguration:
  // If session issuance is disabled (Stage A) but cutoff is already in the past,
  // any newly issued legacy token would immediately be rejected by the middleware!
  if (!sessionEnabled && cutoff.getTime() <= Date.now()) {
    throw new Error(
      `FATAL CONFIGURATION ERROR: LEGACY_TOKEN_CUTOFF_DATE (${cutoff.toISOString()}) is in the past, ` +
      'but ENABLE_SESSION_ISSUANCE is false! This configuration would cause all newly issued tokens ' +
      'to fail authentication immediately. Either extend LEGACY_TOKEN_CUTOFF_DATE to the future or ' +
      'set ENABLE_SESSION_ISSUANCE="true" (Stage B).'
    );
  }
};
