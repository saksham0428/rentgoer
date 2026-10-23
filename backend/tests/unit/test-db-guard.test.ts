import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  sanitizeDatabaseUrl,
  validateTestDatabaseUrl,
  loadAndValidateTestEnvironment,
  sanitizeErrorMessage,
  applyTestEnvironment,
  isStrictLoopbackHost,
  validateRuntimeServerAddress,
} from '../helpers/test-db-guard';

describe('Test Database Environment Safety Guard Unit Tests', () => {
  const SECRET_PASSWORD = 'SuperSecretDbPassword123!';

  // =========================================================================
  // 1. Valid Local Test Database Targets
  // =========================================================================
  describe('Valid Local Loopback Test Targets', () => {
    it('accepts valid localhost PostgreSQL test database URL', () => {
      const rawUrl = `postgresql://postgres:${SECRET_PASSWORD}@localhost:5432/rentgoer_test`;
      const result = validateTestDatabaseUrl(rawUrl);

      expect(result.isLocal).toBe(true);
      expect(result.hostname).toBe('localhost');
      expect(result.port).toBe('5432');
      expect(result.database).toBe('rentgoer_test');
      expect(result.sanitizedDisplay).toBe('postgresql://***:***@localhost:5432/rentgoer_test');
      expect(result.sanitizedDisplay).not.toContain(SECRET_PASSWORD);
      expect(result.sanitizedDisplay).not.toContain('postgres:');
    });

    it('accepts valid 127.0.0.1 IPv4 loopback with query parameters', () => {
      const rawUrl = `postgresql://postgres:${SECRET_PASSWORD}@127.0.0.1:5432/rentgoer_test?schema=public`;
      const result = validateTestDatabaseUrl(rawUrl);

      expect(result.isLocal).toBe(true);
      expect(result.hostname).toBe('127.0.0.1');
      expect(result.database).toBe('rentgoer_test');
    });

    it('accepts IPv6 [::1] loopback test target', () => {
      const rawUrl = `postgresql://postgres:${SECRET_PASSWORD}@[::1]:5432/rentgoer_test`;
      const result = validateTestDatabaseUrl(rawUrl);

      expect(result.isLocal).toBe(true);
      expect(result.hostname).toBe('[::1]');
      expect(result.database).toBe('rentgoer_test');
    });

    it('accepts postgres: shorthand protocol', () => {
      const rawUrl = `postgres://postgres:${SECRET_PASSWORD}@localhost:5432/rentgoer_test`;
      const result = validateTestDatabaseUrl(rawUrl);

      expect(result.isLocal).toBe(true);
      expect(result.database).toBe('rentgoer_test');
    });
  });

  // =========================================================================
  // 2. Immediate Rejection of Cloud / Remote Database Hosts
  // =========================================================================
  describe('Cloud & Remote Host Rejection', () => {
    const cloudTargets = [
      { name: 'Supabase Pooler', host: 'aws-0-ap-south-1.pooler.supabase.com:6543/rentgoer_test' },
      { name: 'Supabase Direct', host: 'db.abcdefghijklm.supabase.co:5432/rentgoer_test' },
      { name: 'Render PostgreSQL', host: 'rentgoer-db.render.com:5432/rentgoer_test' },
      { name: 'Railway', host: 'postgres.railway.app:5432/rentgoer_test' },
      { name: 'Neon Serverless', host: 'ep-cool-project.us-east-2.aws.neon.tech/rentgoer_test' },
      { name: 'AWS RDS', host: 'rentgoer-prod.c123456789.us-east-1.rds.amazonaws.com:5432/rentgoer_test' },
    ];

    for (const target of cloudTargets) {
      it(`aborts and rejects ${target.name} with fail-closed safety error`, () => {
        const rawUrl = `postgresql://admin:${SECRET_PASSWORD}@${target.host}`;

        expect(() => validateTestDatabaseUrl(rawUrl)).toThrow(/SAFETY ABORT: Cloud database host detected/);

        // Confirm credentials are never included in the thrown error message
        try {
          validateTestDatabaseUrl(rawUrl);
        } catch (err: any) {
          expect(err.message).not.toContain(SECRET_PASSWORD);
          expect(err.message).not.toContain('admin:');
        }
      });
    }

    it('rejects LAN and non-loopback IP addresses', () => {
      const lanUrl = `postgresql://admin:${SECRET_PASSWORD}@192.168.1.150:5432/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(lanUrl)).toThrow(/SAFETY ABORT: Destination host .* is not a local loopback/);
    });

    it('rejects Docker and mDNS local network hostnames', () => {
      const dockerUrl = `postgresql://admin:${SECRET_PASSWORD}@host.docker.internal:5432/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(dockerUrl)).toThrow(/SAFETY ABORT: Destination host .* is not a local loopback/);

      const mdnsUrl = `postgresql://admin:${SECRET_PASSWORD}@nas.local:5432/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(mdnsUrl)).toThrow(/SAFETY ABORT: Destination host .* is not a local loopback/);
    });

    it('rejects string-prefix spoofing attacks like 127.example.com', () => {
      const spoofedUrl = `postgresql://admin:${SECRET_PASSWORD}@127.example.com:5432/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(spoofedUrl)).toThrow(
        /SAFETY ABORT: Destination host '127\.example\.com' is not a local loopback/
      );
    });
  });

  // =========================================================================
  // 3. Database Name Boundary Enforcement
  // =========================================================================
  describe('Database Name Enforcement', () => {
    it('rejects production database name (rentgoer) even on localhost', () => {
      const prodUrlOnLocalhost = `postgresql://postgres:${SECRET_PASSWORD}@localhost:5432/rentgoer`;
      expect(() => validateTestDatabaseUrl(prodUrlOnLocalhost)).toThrow(
        /SAFETY ABORT: Destination database is 'rentgoer', expected 'rentgoer_test'/
      );
    });

    it('rejects default postgres administrative database', () => {
      const defaultDb = `postgresql://postgres:${SECRET_PASSWORD}@localhost:5432/postgres`;
      expect(() => validateTestDatabaseUrl(defaultDb)).toThrow(
        /SAFETY ABORT: Destination database is 'postgres', expected 'rentgoer_test'/
      );
    });

    it('rejects empty database path', () => {
      const emptyDb = `postgresql://postgres:${SECRET_PASSWORD}@localhost:5432/`;
      expect(() => validateTestDatabaseUrl(emptyDb)).toThrow(/SAFETY ABORT: Destination database is '', expected 'rentgoer_test'/);
    });
  });

  // =========================================================================
  // 4. Protocol and Formatting Validation
  // =========================================================================
  describe('Protocol & Formatting Validation', () => {
    it('rejects missing or empty database URL', () => {
      expect(() => validateTestDatabaseUrl('')).toThrow(/FAIL-CLOSED DB GUARD: Database connection URL is missing or empty/);
      expect(() => validateTestDatabaseUrl(null as any)).toThrow(/FAIL-CLOSED DB GUARD: Database connection URL is missing or empty/);
    });

    it('rejects non-PostgreSQL protocols', () => {
      const httpUrl = `http://localhost:5432/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(httpUrl)).toThrow(/FAIL-CLOSED DB GUARD: Invalid protocol 'http:'/);

      const mysqlUrl = `mysql://root:${SECRET_PASSWORD}@localhost:3306/rentgoer_test`;
      expect(() => validateTestDatabaseUrl(mysqlUrl)).toThrow(/FAIL-CLOSED DB GUARD: Invalid protocol 'mysql:'/);
    });

    it('rejects malformed URL strings without leaking input', () => {
      expect(() => validateTestDatabaseUrl('not a valid url format:::')).toThrow(
        /FAIL-CLOSED DB GUARD: Invalid database connection URL format/
      );
    });
  });

  // =========================================================================
  // 5. Environment File Loading and Fallback Prevention
  // =========================================================================
  describe('loadAndValidateTestEnvironment', () => {
    it('throws fail-closed error when test env file does not exist', () => {
      const nonexistentPath = path.resolve(__dirname, 'nonexistent.env.test');
      expect(() => loadAndValidateTestEnvironment(nonexistentPath)).toThrow(
        /FAIL-CLOSED DB GUARD: Test environment file 'nonexistent.env.test' was not found/
      );
    });

    it('verifies existing backend/.env.test.local satisfies all safety rules without connecting to DB', () => {
      // Test the actual file on disk
      const config = loadAndValidateTestEnvironment();

      expect(config.target.isLocal).toBe(true);
      expect(config.target.database).toBe('rentgoer_test');
      expect(['localhost', '127.0.0.1']).toContain(config.target.hostname);
      expect(config.target.sanitizedDisplay).not.toContain(SECRET_PASSWORD);
    });
  });

  // =========================================================================
  // 6. Error Message Credential Sanitization
  // =========================================================================
  describe('sanitizeErrorMessage', () => {
    it('masks passwords in postgresql connection error strings', () => {
      const errorString = 'Connection failed at postgresql://postgres:mySecretPass123@localhost:5432/rentgoer_test';
      const sanitized = sanitizeErrorMessage(errorString);

      expect(sanitized).toBe('Connection failed at postgresql://***:***@localhost:5432/rentgoer_test');
      expect(sanitized).not.toContain('mySecretPass123');
    });

    it('masks credentials from Error objects', () => {
      const err = new Error('Prisma error: postgres://admin:superSecret@127.0.0.1:5432/rentgoer_test');
      const sanitized = sanitizeErrorMessage(err);

      expect(sanitized).toContain('postgres://***:***@127.0.0.1:5432/rentgoer_test');
      expect(sanitized).not.toContain('superSecret');
    });

    it('returns error unchanged if no credentials present', () => {
      const msg = 'Ordinary database query syntax error at line 4';
      expect(sanitizeErrorMessage(msg)).toBe(msg);
    });
  });

  // =========================================================================
  // 7. applyTestEnvironment
  // =========================================================================
  describe('applyTestEnvironment', () => {
    it('applies validated test environment to process.env and sets NODE_ENV to test', () => {
      const prevEnv = { ...process.env };
      try {
        const config = applyTestEnvironment();
        expect(process.env.DATABASE_URL).toBe(config.databaseUrl);
        expect(process.env.NODE_ENV).toBe('test');
        expect(config.target.database).toBe('rentgoer_test');
      } finally {
        process.env.DATABASE_URL = prevEnv.DATABASE_URL;
        process.env.DIRECT_URL = prevEnv.DIRECT_URL;
        process.env.NODE_ENV = prevEnv.NODE_ENV;
      }
    });
  });

  // =========================================================================
  // 8. Strict Loopback Hostname Validation (Fix 2)
  // =========================================================================
  describe('isStrictLoopbackHost', () => {
    it('accepts localhost, ::1, and [::1]', () => {
      expect(isStrictLoopbackHost('localhost')).toBe(true);
      expect(isStrictLoopbackHost('::1')).toBe(true);
      expect(isStrictLoopbackHost('[::1]')).toBe(true);
      expect(isStrictLoopbackHost('LOCALHOST')).toBe(true);
    });

    it('accepts valid IPv4 loopback range 127.0.0.0/8', () => {
      expect(isStrictLoopbackHost('127.0.0.1')).toBe(true);
      expect(isStrictLoopbackHost('127.0.0.2')).toBe(true);
      expect(isStrictLoopbackHost('127.1.2.3')).toBe(true);
      expect(isStrictLoopbackHost('127.255.255.255')).toBe(true);
    });

    it('strictly rejects domain names starting with 127.', () => {
      expect(isStrictLoopbackHost('127.example.com')).toBe(false);
      expect(isStrictLoopbackHost('127.0.0.1.attacker.com')).toBe(false);
      expect(isStrictLoopbackHost('127-local.com')).toBe(false);
    });

    it('rejects out-of-range octets and non-loopback IPs', () => {
      expect(isStrictLoopbackHost('127.256.0.1')).toBe(false);
      expect(isStrictLoopbackHost('128.0.0.1')).toBe(false);
      expect(isStrictLoopbackHost('192.168.1.1')).toBe(false);
      expect(isStrictLoopbackHost('10.0.0.1')).toBe(false);
      expect(isStrictLoopbackHost('')).toBe(false);
      expect(isStrictLoopbackHost(null as any)).toBe(false);
    });
  });

  // =========================================================================
  // 9. Runtime Server Address Validation (Fix 1)
  // =========================================================================
  describe('validateRuntimeServerAddress', () => {
    it('accepts IPv4 loopback addresses with and without CIDR netmask', () => {
      expect(validateRuntimeServerAddress('127.0.0.1')).toBe(true);
      expect(validateRuntimeServerAddress('127.0.0.1/32')).toBe(true);
      expect(validateRuntimeServerAddress('127.0.1.10/32')).toBe(true);
      expect(validateRuntimeServerAddress('127.255.255.255/32')).toBe(true);
    });

    it('accepts IPv6 loopback addresses with and without CIDR netmask', () => {
      expect(validateRuntimeServerAddress('::1')).toBe(true);
      expect(validateRuntimeServerAddress('::1/128')).toBe(true);
    });

    it('rejects non-loopback IP addresses with fail-closed safety error', () => {
      expect(() => validateRuntimeServerAddress('192.168.1.100')).toThrow(
        /SAFETY ABORT: PostgreSQL server address '192\.168\.1\.100' is not a valid local loopback address/
      );
      expect(() => validateRuntimeServerAddress('10.0.0.5/32')).toThrow(
        /SAFETY ABORT: PostgreSQL server address '10\.0\.0\.5' is not a valid local loopback address/
      );
      expect(() => validateRuntimeServerAddress('54.210.10.50')).toThrow(
        /SAFETY ABORT: PostgreSQL server address '54\.210\.10\.50' is not a valid local loopback address/
      );
    });

    it('rejects NULL server address when configured connection is TCP localhost', () => {
      expect(() => validateRuntimeServerAddress(null, 'localhost')).toThrow(
        /SAFETY ABORT: PostgreSQL server address is NULL, but connection configuration is not a Unix-domain socket/
      );
      expect(() => validateRuntimeServerAddress(undefined, '127.0.0.1')).toThrow(
        /SAFETY ABORT: PostgreSQL server address is NULL, but connection configuration is not a Unix-domain socket/
      );
    });

    it('deliberately permits NULL server address when configured host is an explicit Unix domain socket path', () => {
      expect(validateRuntimeServerAddress(null, '/var/run/postgresql')).toBe(true);
      expect(validateRuntimeServerAddress(null, '%2Ftmp')).toBe(true);
      expect(validateRuntimeServerAddress(undefined, '/tmp/.s.PGSQL.5432')).toBe(true);
    });
  });
});


