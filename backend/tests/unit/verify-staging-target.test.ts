import { describe, it, expect } from 'vitest';
import {
  parseAndValidateStagingUrl,
  EXPECTED_STAGING_PROJECT_REF,
  FORBIDDEN_PRODUCTION_PROJECT_REF,
} from '../../src/scripts/verify-staging-target';

describe('Positive Staging Target Safety Guard (parseAndValidateStagingUrl)', () => {
  const validDirectStagingUrl = `postgresql://postgres.${EXPECTED_STAGING_PROJECT_REF}:mypassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
  const validPoolerStagingUrl = `postgresql://postgres.${EXPECTED_STAGING_PROJECT_REF}:mypassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;

  it('passes when given a valid staging DIRECT_URL on port 5432 with positive project reference', () => {
    const res = parseAndValidateStagingUrl(validDirectStagingUrl, 'DIRECT_URL');
    expect(res.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');
    expect(res.port).toBe('5432');
    expect(res.pathname).toBe('postgres');
    expect(res.username).toContain(EXPECTED_STAGING_PROJECT_REF);
  });

  it('passes when given a valid staging DATABASE_URL on port 6543 with positive project reference', () => {
    const res = parseAndValidateStagingUrl(validPoolerStagingUrl, 'DATABASE_URL');
    expect(res.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');
    expect(res.port).toBe('6543');
    expect(res.pathname).toBe('postgres');
    expect(res.username).toContain(EXPECTED_STAGING_PROJECT_REF);
  });

  it('rejects if DIRECT_URL is configured on port 6543 (transaction pooler)', () => {
    const poolerAsDirect = `postgresql://postgres.${EXPECTED_STAGING_PROJECT_REF}:mypassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
    expect(() => parseAndValidateStagingUrl(poolerAsDirect, 'DIRECT_URL')).toThrow(
      /port 6543 \(transaction pooler\)/i
    );
  });

  it('rejects if URL contains production project reference in hostname or username', () => {
    const prodUrl = `postgresql://postgres.${FORBIDDEN_PRODUCTION_PROJECT_REF}:mypassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    expect(() => parseAndValidateStagingUrl(prodUrl, 'DIRECT_URL')).toThrow(
      /production project reference .* detected/i
    );
  });

  it('rejects if URL does NOT positively contain expected staging project reference', () => {
    const randomUrl = `postgresql://postgres.someotherprojectref:mypassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    expect(() => parseAndValidateStagingUrl(randomUrl, 'DIRECT_URL')).toThrow(
      /does not contain expected staging project reference/i
    );
  });

  it('rejects loopback hostnames (localhost, 127.0.0.1)', () => {
    const loopbackUrl = `postgresql://postgres:postgres@localhost:5432/${EXPECTED_STAGING_PROJECT_REF}`;
    expect(() => parseAndValidateStagingUrl(loopbackUrl, 'DIRECT_URL')).toThrow(
      /specifies loopback host/i
    );
  });

  it('rejects local databases rentgoer_dev and rentgoer_test', () => {
    const devDbUrl = `postgresql://postgres.${EXPECTED_STAGING_PROJECT_REF}:pass@aws-0-ap-south-1.pooler.supabase.com:5432/rentgoer_dev`;
    expect(() => parseAndValidateStagingUrl(devDbUrl, 'DIRECT_URL')).toThrow(
      /specifies local database 'rentgoer_dev'/i
    );
  });

  it('fails closed when raw URL is missing, null, or empty', () => {
    expect(() => parseAndValidateStagingUrl(undefined, 'DIRECT_URL')).toThrow(
      /is not set or empty/i
    );
    expect(() => parseAndValidateStagingUrl('', 'DIRECT_URL')).toThrow(
      /is not set or empty/i
    );
  });
});
