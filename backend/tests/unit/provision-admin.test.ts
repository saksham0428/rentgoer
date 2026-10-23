import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sanitizeErrorMessage,
  sanitizeDatabaseUrl,
  validateTargetEnvironment,
  verifyAuthorizationSecret,
  parseProvisioningArgs,
  validateAdminInputs,
} from '../../src/scripts/provision-admin';

describe('Admin Provisioning Safety & Validation Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ---------------------------------------------------------------------------
  // 1. Error Message Sanitization
  // ---------------------------------------------------------------------------
  describe('sanitizeErrorMessage', () => {
    it('redacts database credentials and passwords from exception strings', () => {
      const leakedError =
        'Connection failed at postgresql://postgres:SuperSecretPassword123!@aws-0.pooler.supabase.com:6543/postgres?password=secretToken';
      const cleanError = sanitizeErrorMessage(leakedError);

      expect(cleanError).not.toContain('SuperSecretPassword123!');
      expect(cleanError).toContain('postgresql://[REDACTED_CREDENTIALS]@');
      expect(cleanError).toContain('password=[REDACTED]');
    });

    it('handles empty and non-string inputs safely', () => {
      expect(sanitizeErrorMessage('')).toBe('');
      expect(sanitizeErrorMessage(null as any)).toBe('');
      expect(sanitizeErrorMessage(undefined as any)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Database URL Parsing, Fingerprinting & Sanitization
  // ---------------------------------------------------------------------------
  describe('sanitizeDatabaseUrl', () => {
    it('strictly classifies recognized loopback hosts as local and masks credentials', () => {
      const localHosts = [
        'postgresql://user:pass@localhost:5432/rentgoer_dev',
        'postgresql://user:pass@127.0.0.1:5432/rentgoer_dev',
        'postgresql://user:pass@[::1]:5432/rentgoer_dev',
        'postgresql://user:pass@127.0.0.99:5432/rentgoer_dev',
      ];

      for (const url of localHosts) {
        const sanitized = sanitizeDatabaseUrl(url);
        expect(sanitized.isLocal).toBe(true);
        expect(sanitized.sanitizedDisplay).not.toContain('pass');
        expect(sanitized.sanitizedDisplay).not.toContain('user:');
        expect(sanitized.sanitizedDisplay).toContain('Target Host:');
      }
    });

    it('classifies cloud, remote, mDNS, and container hosts as remote', () => {
      const remoteHosts = [
        'postgresql://postgres.myprojectref:SuperSecretPass123!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require',
        'postgresql://admin:SecretPass@rentgoer-db.render.com:5432/rentgoer_prod',
        'postgresql://admin:SecretPass@postgres.railway.app:5432/railway',
        'postgresql://admin:SecretPass@my-nas.local:5432/dev', // .local mDNS must NOT be local
        'postgresql://admin:SecretPass@host.docker.internal:5432/dev', // Docker internal must NOT be local
        'postgresql://admin:SecretPass@192.168.1.50:5432/internal_db', // LAN IP must NOT be local
      ];

      for (const url of remoteHosts) {
        const sanitized = sanitizeDatabaseUrl(url);
        expect(sanitized.isLocal).toBe(false);
        expect(sanitized.sanitizedDisplay).not.toContain('SecretPass');
        expect(sanitized.sanitizedDisplay).toContain('Remote / Cloud Host');
      }
    });

    it('extracts Supabase projectRef and calculates 16-character SHA-256 target fingerprint', () => {
      const rawSupabaseUrl =
        'postgresql://postgres.proj123ref:SuperSecretPass123!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require';
      const sanitized = sanitizeDatabaseUrl(rawSupabaseUrl);

      expect(sanitized.projectRef).toBe('proj123ref');
      expect(sanitized.targetFingerprint).toHaveLength(16);
      expect(sanitized.sanitizedDisplay).toContain('Project Ref: proj123ref');
      expect(sanitized.sanitizedDisplay).toContain('Target Fingerprint (SHA-256):');
    });

    it('rejects missing, empty, or malformed database URLs safely', () => {
      expect(() => sanitizeDatabaseUrl('')).toThrow(/DATABASE_URL is not configured/);
      expect(() => sanitizeDatabaseUrl(undefined)).toThrow(/DATABASE_URL is not configured/);
      expect(() => sanitizeDatabaseUrl('not-a-valid-database-url')).toThrow(/malformed/);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Target Environment Safeguards (Dual-Lock & Confirmation)
  // ---------------------------------------------------------------------------
  describe('validateTargetEnvironment', () => {
    const remoteTarget = sanitizeDatabaseUrl(
      'postgresql://admin:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
    );
    const localTarget = sanitizeDatabaseUrl('postgresql://postgres:pass@localhost:5432/rentgoer_dev');

    it('blocks remote execution when neither env flag nor CLI confirmation is provided', () => {
      delete process.env.ALLOW_REMOTE_PROVISION;
      const res = validateTargetEnvironment(remoteTarget, { allowRemote: false, confirmTarget: true });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('ALLOW_REMOTE_PROVISION=true');
      expect(res.reason).toContain('--confirm-remote');
    });

    it('blocks remote execution when ALLOW_REMOTE_PROVISION=true but --confirm-remote is missing', () => {
      process.env.ALLOW_REMOTE_PROVISION = 'true';
      const res = validateTargetEnvironment(remoteTarget, { allowRemote: false, confirmTarget: true });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('--confirm-remote');
    });

    it('blocks remote execution when --confirm-remote is supplied but ALLOW_REMOTE_PROVISION=true is missing', () => {
      delete process.env.ALLOW_REMOTE_PROVISION;
      const res = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: true });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('ALLOW_REMOTE_PROVISION=true');
    });

    it('blocks remote execution without explicit target confirmation (--confirm-target)', () => {
      process.env.ALLOW_REMOTE_PROVISION = 'true';
      const res = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: false });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Explicit confirmation of the target database');
    });

    it('permits remote execution ONLY when dual-locks and target confirmation are all satisfied', () => {
      process.env.ALLOW_REMOTE_PROVISION = 'true';
      const res = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: true });
      expect(res.allowed).toBe(true);
    });

    it('strictly requires explicit target confirmation for local development databases', () => {
      expect(validateTargetEnvironment(localTarget, { confirmTarget: false }).allowed).toBe(false);
      expect(validateTargetEnvironment(localTarget, { confirmTarget: true }).allowed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Authorization Secret Verification
  // ---------------------------------------------------------------------------
  describe('verifyAuthorizationSecret', () => {
    const validExpectedSecret = 'SuperSecureLongAdminSecretKey2026!';

    it('rejects missing or short (< 16 chars) server authorization secret', () => {
      const missing = verifyAuthorizationSecret('any-secret', '');
      expect(missing.authorized).toBe(false);
      expect(missing.reason).toContain('ADMIN_PROVISION_SECRET is not configured');

      const weak = verifyAuthorizationSecret('any-secret', 'short_secret');
      expect(weak.authorized).toBe(false);
      expect(weak.reason).toContain('too weak');
    });

    it('rejects missing or empty operator secret', () => {
      const res = verifyAuthorizationSecret('', validExpectedSecret);
      expect(res.authorized).toBe(false);
      expect(res.reason).toContain('Missing provisioning authorization secret');
    });

    it('rejects mismatched secret via timing-safe comparison', () => {
      const res = verifyAuthorizationSecret('WrongSecretToken12345', validExpectedSecret);
      expect(res.authorized).toBe(false);
      expect(res.reason).toContain('does not match');
    });

    it('accepts valid matching authorization secret', () => {
      const res = verifyAuthorizationSecret(validExpectedSecret, validExpectedSecret);
      expect(res.authorized).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CLI Argument Parsing & Dangerous Flag Rejection
  // ---------------------------------------------------------------------------
  describe('parseProvisioningArgs', () => {
    it('throws security violation without echoing credentials when dangerous flags are passed', () => {
      expect(() => parseProvisioningArgs(['--secret=mysecret12345'])).toThrow(/Security Violation/);
      expect(() => parseProvisioningArgs(['-s'])).toThrow(/Security Violation/);
      expect(() => parseProvisioningArgs(['--password=MyPassword123!'])).toThrow(/Security Violation/);
      expect(() => parseProvisioningArgs(['-p'])).toThrow(/Security Violation/);

      // Verify credentials are not echoed in exception message
      try {
        parseProvisioningArgs(['--secret=sensitive_pass_token']);
      } catch (err: any) {
        expect(err.message).not.toContain('sensitive_pass_token');
      }
    });

    it('rejects unrecognized CLI flags', () => {
      expect(() => parseProvisioningArgs(['--invalid-flag'])).toThrow(/Unrecognized command-line argument/);
    });

    it('parses valid operational flags correctly', () => {
      const parsed = parseProvisioningArgs([
        '--dry-run',
        '--confirm-target',
        '--confirm-remote',
        '--email=admin@rentgoer.com',
        '--name=Test Administrator',
      ]);

      expect(parsed.dryRun).toBe(true);
      expect(parsed.confirmTarget).toBe(true);
      expect(parsed.confirmRemote).toBe(true);
      expect(parsed.email).toBe('admin@rentgoer.com');
      expect(parsed.name).toBe('Test Administrator');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Credential & Password Complexity Validation
  // ---------------------------------------------------------------------------
  describe('validateAdminInputs', () => {
    it('rejects empty or malformed email addresses', () => {
      expect(validateAdminInputs('', 'Admin', 'StrongP@ss1').valid).toBe(false);
      expect(validateAdminInputs('invalid-email', 'Admin', 'StrongP@ss1').valid).toBe(false);
    });

    it('rejects invalid administrator name lengths (< 2 or > 64 chars)', () => {
      expect(validateAdminInputs('admin@example.com', 'A', 'StrongP@ss1').valid).toBe(false);
      expect(validateAdminInputs('admin@example.com', 'a'.repeat(65), 'StrongP@ss1').valid).toBe(false);
    });

    it('enforces password complexity rules (length >= 8, uppercase, lowercase, digit)', () => {
      expect(validateAdminInputs('admin@example.com', 'Admin User', 'short1').valid).toBe(false); // < 8
      expect(validateAdminInputs('admin@example.com', 'Admin User', 'alllowercase1').valid).toBe(false); // No upper
      expect(validateAdminInputs('admin@example.com', 'Admin User', 'ALLUPPERCASE1').valid).toBe(false); // No lower
      expect(validateAdminInputs('admin@example.com', 'Admin User', 'NoDigitsPassword').valid).toBe(false); // No digit
    });

    it('rejects password confirmation mismatch', () => {
      const res = validateAdminInputs('admin@example.com', 'Admin User', 'StrongP@ss1', 'DifferentP@ss1');
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/does not match/i);
    });

    it('accepts valid credentials, trims name, and normalizes email to lowercase', () => {
      const valid = validateAdminInputs(
        '  Admin.Root@Example.COM  ',
        '  Platform Admin  ',
        'SecurePassword2026!',
        'SecurePassword2026!'
      );

      expect(valid.valid).toBe(true);
      expect(valid.normalizedEmail).toBe('admin.root@example.com');
      expect(valid.normalizedName).toBe('Platform Admin');
    });
  });
});
