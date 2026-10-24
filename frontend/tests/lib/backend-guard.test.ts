import { describe, it, expect } from 'vitest';
import {
  validateTestBackendUrl,
  getSafeBackendUrl,
} from '@/lib/backend-guard';

describe('SEC-03: Backend URL Validation & Test Isolation Guard', () => {
  describe('validateTestBackendUrl', () => {
    it('1. accepts valid loopback address on isolated test port 5001 (127.0.0.1)', () => {
      expect(validateTestBackendUrl('http://127.0.0.1:5001')).toBe('http://127.0.0.1:5001');
      expect(validateTestBackendUrl('http://127.0.0.1:5001/')).toBe('http://127.0.0.1:5001');
    });

    it('2. accepts valid localhost address on isolated test port 5001', () => {
      expect(validateTestBackendUrl('http://localhost:5001')).toBe('http://localhost:5001');
      expect(validateTestBackendUrl('http://localhost:5001/api')).toBe('http://localhost:5001');
    });

    it('3. accepts valid IPv6 loopback on isolated test port 5001', () => {
      expect(validateTestBackendUrl('http://[::1]:5001')).toBe('http://[::1]:5001');
    });

    it('4. rejects missing or empty backend URL under test mode', () => {
      expect(() => validateTestBackendUrl(undefined)).toThrow(
        /NEXT_PUBLIC_BACKEND_URL is required under test mode/i
      );
      expect(() => validateTestBackendUrl('')).toThrow(
        /NEXT_PUBLIC_BACKEND_URL is required under test mode/i
      );
      expect(() => validateTestBackendUrl('   ')).toThrow(
        /NEXT_PUBLIC_BACKEND_URL is required under test mode/i
      );
    });

    it('5. strictly rejects development port 5000', () => {
      expect(() => validateTestBackendUrl('http://localhost:5000')).toThrow(
        /Invalid test backend port '5000'.*Development port 5000 and arbitrary ports are rejected/i
      );
      expect(() => validateTestBackendUrl('http://127.0.0.1:5000')).toThrow(
        /Invalid test backend port '5000'/i
      );
    });

    it('6. strictly rejects arbitrary ports other than 5001', () => {
      expect(() => validateTestBackendUrl('http://localhost:3000')).toThrow(
        /Invalid test backend port '3000'/i
      );
      expect(() => validateTestBackendUrl('http://127.0.0.1:8080')).toThrow(
        /Invalid test backend port '8080'/i
      );
    });

    it('7. strictly rejects remote production and staging domains', () => {
      expect(() => validateTestBackendUrl('http://rentgoer-backend.onrender.com:5001')).toThrow(
        /Forbidden test backend host 'rentgoer-backend.onrender.com'/i
      );
      expect(() => validateTestBackendUrl('http://api.rentgoer.com:5001')).toThrow(
        /Forbidden test backend host 'api.rentgoer.com'/i
      );
      expect(() => validateTestBackendUrl('http://supabase.co:5001')).toThrow(
        /Forbidden test backend host 'supabase.co'/i
      );
      expect(() => validateTestBackendUrl('http://192.168.1.10:5001')).toThrow(
        /Forbidden test backend host '192.168.1.10'/i
      );
    });

    it('8. strictly rejects HTTPS protocol in test mode', () => {
      expect(() => validateTestBackendUrl('https://localhost:5001')).toThrow(
        /Invalid protocol 'https:' for test backend.*Expected 'http:'/i
      );
    });

    it('9. strictly rejects malformed URL strings', () => {
      expect(() => validateTestBackendUrl('not-a-valid-url')).toThrow(
        /malformed and could not be parsed/i
      );
    });
  });

  describe('getSafeBackendUrl', () => {
    it('10. in test mode, validates and enforces port 5001', () => {
      const url = getSafeBackendUrl({
        rawUrl: 'http://127.0.0.1:5001',
        isTestMode: true,
      });
      expect(url).toBe('http://127.0.0.1:5001');

      expect(() =>
        getSafeBackendUrl({
          rawUrl: 'http://localhost:5000',
          isTestMode: true,
        })
      ).toThrow(/Invalid test backend port '5000'/i);
    });

    it('11. outside test mode, preserves standard dev fallback to port 5000', () => {
      const defaultUrl = getSafeBackendUrl({
        rawUrl: undefined,
        isTestMode: false,
      });
      expect(defaultUrl).toBe('http://localhost:5000');
    });

    it('12. outside test mode, allows standard production URLs', () => {
      const prodUrl = getSafeBackendUrl({
        rawUrl: 'https://api.rentgoer.com',
        isTestMode: false,
      });
      expect(prodUrl).toBe('https://api.rentgoer.com');
    });
  });
});
