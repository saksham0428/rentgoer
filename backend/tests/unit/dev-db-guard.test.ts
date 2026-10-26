import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyDevEnvironment } from '../../src/config/dev-db-guard';

describe('applyDevEnvironment - Development Database Isolation Guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('skips guard when NODE_ENV is test and no explicit path is passed', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://user:pass@remote.supabase.com:6543/postgres';

    // Must not throw because test environment is governed by test-db-guard
    expect(() => applyDevEnvironment()).not.toThrow();
  });

  it('skips guard when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@remote.supabase.com:6543/postgres';

    // Must not throw for production builds/environments
    expect(() => applyDevEnvironment(false)).not.toThrow();
  });

  it('throws SAFETY ABORT when DATABASE_URL targets a cloud domain in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

    expect(() => applyDevEnvironment(false)).toThrow(/SAFETY ABORT.*Cloud database host.*detected/i);
  });

  it('throws SAFETY ABORT when DATABASE_URL host is not a loopback address', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:pass@192.168.1.50:5432/rentgoer_dev';

    expect(() => applyDevEnvironment(false)).toThrow(/SAFETY ABORT.*not a local loopback/i);
  });

  it('throws SAFETY ABORT when database name is not rentgoer_dev', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/rentgoer_test';

    expect(() => applyDevEnvironment(false)).toThrow(/SAFETY ABORT.*expected 'rentgoer_dev'/i);
  });

  it('succeeds, sets port 5000, and enables storage write protections when targeting local rentgoer_dev', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PORT;

    // applyDevEnvironment without args loads .env.development.local from disk
    expect(() => applyDevEnvironment()).not.toThrow();

    expect(process.env.DATABASE_URL).toContain('rentgoer_dev');
    expect(process.env.PORT).toBe('5000');
    expect(process.env.DISABLE_PRODUCTION_STORAGE_WRITES).toBe('true');
  });
});
