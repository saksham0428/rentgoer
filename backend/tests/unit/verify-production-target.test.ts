import { describe, it, expect } from 'vitest';
import {
  parseAndValidateProductionUrl,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORBIDDEN_STAGING_PROJECT_REF,
  EXPECTED_REGION,
} from '../../src/scripts/verify-production-target';

describe('Positive Production Target Safety Guard (parseAndValidateProductionUrl)', () => {
  const validDirectProdUrl = `postgresql://postgres.${EXPECTED_PRODUCTION_PROJECT_REF}:mypassword@aws-0-${EXPECTED_REGION}.pooler.supabase.com:5432/postgres`;
  const validPoolerProdUrl = `postgresql://postgres.${EXPECTED_PRODUCTION_PROJECT_REF}:mypassword@aws-0-${EXPECTED_REGION}.pooler.supabase.com:6543/postgres?pgbouncer=true`;

  it('passes when given a valid production DIRECT_URL on port 5432 with positive project reference and region', () => {
    const res = parseAndValidateProductionUrl(validDirectProdUrl, 'DIRECT_URL');
    expect(res.hostname).toBe(`aws-0-${EXPECTED_REGION}.pooler.supabase.com`);
    expect(res.port).toBe('5432');
    expect(res.pathname).toBe('postgres');
    expect(res.username).toContain(EXPECTED_PRODUCTION_PROJECT_REF);
  });

  it('passes when given a valid production DATABASE_URL on port 6543 with positive project reference and region', () => {
    const res = parseAndValidateProductionUrl(validPoolerProdUrl, 'DATABASE_URL');
    expect(res.hostname).toBe(`aws-0-${EXPECTED_REGION}.pooler.supabase.com`);
    expect(res.port).toBe('6543');
    expect(res.pathname).toBe('postgres');
    expect(res.username).toContain(EXPECTED_PRODUCTION_PROJECT_REF);
  });

  it('rejects if DIRECT_URL is configured on port 6543 (transaction pooler)', () => {
    const poolerAsDirect = `postgresql://postgres.${EXPECTED_PRODUCTION_PROJECT_REF}:mypassword@aws-0-${EXPECTED_REGION}.pooler.supabase.com:6543/postgres`;
    expect(() => parseAndValidateProductionUrl(poolerAsDirect, 'DIRECT_URL')).toThrow(
      /port 6543 \(transaction pooler\)/i
    );
  });

  it('rejects if URL contains staging project reference in hostname or username', () => {
    const stagingUrl = `postgresql://postgres.${FORBIDDEN_STAGING_PROJECT_REF}:mypassword@aws-0-${EXPECTED_REGION}.pooler.supabase.com:5432/postgres`;
    expect(() => parseAndValidateProductionUrl(stagingUrl, 'DIRECT_URL')).toThrow(
      /staging project reference .* detected/i
    );
  });

  it('rejects if URL does NOT positively contain expected production project reference', () => {
    const randomUrl = `postgresql://postgres.someotherprojectref:mypassword@aws-0-${EXPECTED_REGION}.pooler.supabase.com:5432/postgres`;
    expect(() => parseAndValidateProductionUrl(randomUrl, 'DIRECT_URL')).toThrow(
      /does not contain expected production project reference/i
    );
  });

  it('rejects if URL does NOT match expected region (ap-south-1)', () => {
    const wrongRegionUrl = `postgresql://postgres.${EXPECTED_PRODUCTION_PROJECT_REF}:mypassword@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
    expect(() => parseAndValidateProductionUrl(wrongRegionUrl, 'DIRECT_URL')).toThrow(
      /does not match expected production region/i
    );
  });

  it('rejects loopback hostnames (localhost, 127.0.0.1)', () => {
    const loopbackUrl = `postgresql://postgres:postgres@localhost:5432/${EXPECTED_PRODUCTION_PROJECT_REF}`;
    expect(() => parseAndValidateProductionUrl(loopbackUrl, 'DIRECT_URL')).toThrow(
      /specifies loopback host/i
    );
  });

  it('rejects local databases rentgoer_dev and rentgoer_test', () => {
    const devDbUrl = `postgresql://postgres.${EXPECTED_PRODUCTION_PROJECT_REF}:pass@aws-0-${EXPECTED_REGION}.pooler.supabase.com:5432/rentgoer_dev`;
    expect(() => parseAndValidateProductionUrl(devDbUrl, 'DIRECT_URL')).toThrow(
      /specifies local database 'rentgoer_dev'/i
    );
  });

  it('fails closed when raw URL is missing, null, or empty', () => {
    expect(() => parseAndValidateProductionUrl(undefined, 'DIRECT_URL')).toThrow(
      /is not set or empty/i
    );
    expect(() => parseAndValidateProductionUrl('', 'DIRECT_URL')).toThrow(
      /is not set or empty/i
    );
  });
});

