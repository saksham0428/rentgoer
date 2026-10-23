import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSessionIssuanceEnabled, getLegacyCutoffDate } from '../../src/config/auth.config';

describe('auth.config unit tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isSessionIssuanceEnabled', () => {
    it('returns false when ENABLE_SESSION_ISSUANCE is unset or empty', () => {
      delete process.env.ENABLE_SESSION_ISSUANCE;
      expect(isSessionIssuanceEnabled()).toBe(false);

      process.env.ENABLE_SESSION_ISSUANCE = '';
      expect(isSessionIssuanceEnabled()).toBe(false);
    });

    it('returns true when ENABLE_SESSION_ISSUANCE is "true" or "1"', () => {
      process.env.ENABLE_SESSION_ISSUANCE = 'true';
      expect(isSessionIssuanceEnabled()).toBe(true);

      process.env.ENABLE_SESSION_ISSUANCE = '1';
      expect(isSessionIssuanceEnabled()).toBe(true);

      process.env.ENABLE_SESSION_ISSUANCE = ' TRUE ';
      expect(isSessionIssuanceEnabled()).toBe(true);
    });

    it('returns false when ENABLE_SESSION_ISSUANCE is "false" or "0"', () => {
      process.env.ENABLE_SESSION_ISSUANCE = 'false';
      expect(isSessionIssuanceEnabled()).toBe(false);

      process.env.ENABLE_SESSION_ISSUANCE = '0';
      expect(isSessionIssuanceEnabled()).toBe(false);
    });

    it('throws error when ENABLE_SESSION_ISSUANCE has an invalid string', () => {
      process.env.ENABLE_SESSION_ISSUANCE = 'invalid_val';
      expect(() => isSessionIssuanceEnabled()).toThrow(/FATAL CONFIGURATION ERROR/);
    });
  });

  describe('getLegacyCutoffDate', () => {
    it('throws error when LEGACY_TOKEN_CUTOFF_DATE is missing', () => {
      delete process.env.LEGACY_TOKEN_CUTOFF_DATE;
      expect(() => getLegacyCutoffDate()).toThrow(/is missing/);
    });

    it('parses valid ISO cutoff date correctly', () => {
      process.env.LEGACY_TOKEN_CUTOFF_DATE = '2026-10-28T00:00:00.000Z';
      const parsed = getLegacyCutoffDate();
      expect(parsed.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    });

    it('throws error when cutoff date string is malformed', () => {
      process.env.LEGACY_TOKEN_CUTOFF_DATE = 'not-a-date';
      expect(() => getLegacyCutoffDate()).toThrow(/is invalid/);
    });
  });
});
