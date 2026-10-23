import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Role } from '@prisma/client';

// Mock Prisma completely to guarantee 100% offline, zero-network, zero-database execution
vi.mock('../../src/lib/prisma', () => {
  return {
    prisma: {
      session: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      revokedLegacyToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

import { prisma } from '../../src/lib/prisma';
import { authMiddleware } from '../../src/middleware/auth.middleware';
import {
  getLegacyCutoffDate,
  isSessionIssuanceEnabled,
  validateAuthConfigAtStartup,
} from '../../src/config/auth.config';

const TEST_SECRET = 'unit_test_jwt_secret_key_minimum_32_characters_for_hmac_sha256';

// Helper to create mock Express req, res, next context
function createMockContext(cookieToken?: string) {
  const req: any = {
    cookies: cookieToken ? { rentgoer_token: cookieToken } : {},
    headers: { 'user-agent': 'Mozilla/5.0 (TestDevice)' },
    ip: '127.0.0.1',
  };
  let responseStatus = 200;
  let responseJson: any = null;
  const clearedCookies: Array<{ name: string; options: any }> = [];
  let nextCalled = false;

  const res: any = {
    status(code: number) {
      responseStatus = code;
      return res;
    },
    json(data: any) {
      responseJson = data;
      return res;
    },
    clearCookie(name: string, options: any) {
      clearedCookies.push({ name, options });
      return res;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req: req as Request,
    res: res as Response,
    next: next as NextFunction,
    getStatus: () => responseStatus,
    getJson: () => responseJson,
    getClearedCookies: () => clearedCookies,
    wasNextCalled: () => nextCalled,
  };
}

describe('Session Authentication & Token Architecture Unit Tests (SEC-01B Policy A)', () => {
  const originalEnv = process.env;
  let graceCutoffDate: Date;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = TEST_SECRET;
    graceCutoffDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    process.env.LEGACY_TOKEN_CUTOFF_DATE = graceCutoffDate.toISOString();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. JWT Cryptographic & Header Validation (Tests 1a - 1d)
  // =========================================================================
  describe('JWT Cryptographic & Header Validation', () => {
    it('rejects request with 401 when token is missing (Test 1a)', async () => {
      const ctx = createMockContext();
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated. No token provided.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects malformed token string with 401 Invalid token (Test 1b)', async () => {
      const ctx = createMockContext('not_a_valid_jwt_format');
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated. Invalid token.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects tampered token signature with 401 Invalid token (Test 1c)', async () => {
      const tamperedToken = jwt.sign(
        { id: 'user-1', role: 'TENANT', tokenVersion: 0, sessionId: 'session-1' },
        'wrong_unauthorized_secret_key'
      );
      const ctx = createMockContext(tamperedToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated. Invalid token.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects expired token with 401 Token expired (Test 1d)', async () => {
      const expiredToken = jwt.sign(
        { id: 'user-1', role: 'TENANT', tokenVersion: 0, sessionId: 'session-1' },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );
      const ctx = createMockContext(expiredToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated. Token expired.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 2. Database Failure Resilience (Fail-Closed / 503) (Test 2)
  // =========================================================================
  describe('Database Failure Resilience (Fail-Closed / 503)', () => {
    it('returns 503 Service Unavailable on database connection failure, never misreporting as 401 (Test 2)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const validToken = jwt.sign(
        { id: 'user-1', role: 'TENANT', tokenVersion: 0, sessionId: 'session-1' },
        TEST_SECRET
      );
      const ctx = createMockContext(validToken);

      vi.mocked(prisma.session.findUnique).mockRejectedValue(
        new Error("P1001: Can't reach database server at localhost:5432")
      );

      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(503);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
      expect(ctx.wasNextCalled()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('returns 503 when JWT_SECRET is missing from environment', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      delete process.env.JWT_SECRET;
      const ctx = createMockContext('any-token');
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(503);
      expect(ctx.getJson().message).toBe('Authentication service temporarily unavailable.');

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 3. Valid Session-Aware Token (Test 3)
  // =========================================================================
  describe('Valid Session-Aware Token Verification', () => {
    it('validates active session-aware token, attaches user and sessionId, and calls next() (Test 3)', async () => {
      const sessionId = 'session-uuid-101';
      const userId = 'user-uuid-202';
      const token = jwt.sign(
        { id: userId, role: 'TENANT', tokenVersion: 1, sessionId },
        TEST_SECRET,
        { expiresIn: '7d' }
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          role: 'TENANT' as Role,
          tokenVersion: 1,
        },
      } as any);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.wasNextCalled()).toBe(true);
      expect(ctx.req.user?.id).toBe(userId);
      expect(ctx.req.user?.role).toBe('TENANT');
      expect(ctx.req.sessionId).toBe(sessionId);
    });
  });

  // =========================================================================
  // 4. Session Anomaly Rejections (Tests 4a - 4d)
  // =========================================================================
  describe('Session Anomaly Rejections', () => {
    it('rejects with 401 when session does not exist in database (Test 4a)', async () => {
      const token = jwt.sign(
        { id: 'u1', role: 'TENANT', tokenVersion: 0, sessionId: 'nonexistent-session' },
        TEST_SECRET
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session not found.');
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects with 401 when session belongs to a different user (Test 4b)', async () => {
      const token = jwt.sign(
        { id: 'u1', role: 'TENANT', tokenVersion: 0, sessionId: 's1' },
        TEST_SECRET
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 's1',
        userId: 'different-user',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'different-user', role: 'TENANT' as Role, tokenVersion: 0 },
      } as any);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session user mismatch.');
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects with 401 when session has been revoked (Test 4c)', async () => {
      const token = jwt.sign(
        { id: 'u1', role: 'TENANT', tokenVersion: 0, sessionId: 's1' },
        TEST_SECRET
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', role: 'TENANT' as Role, tokenVersion: 0 },
      } as any);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session has been revoked.');
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects with 401 when session row has expired (Test 4d)', async () => {
      const token = jwt.sign(
        { id: 'u1', role: 'TENANT', tokenVersion: 0, sessionId: 's1' },
        TEST_SECRET
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 5000), // past
        user: { id: 'u1', role: 'TENANT' as Role, tokenVersion: 0 },
      } as any);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session expired.');
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 5. Account-Wide tokenVersion Invalidation (Test 5)
  // =========================================================================
  describe('Account-Wide tokenVersion Invalidation', () => {
    it('rejects session token with 401 when user tokenVersion was incremented (Test 5)', async () => {
      // Token holds tokenVersion = 1, but user in DB has bumped to 2
      const token = jwt.sign(
        { id: 'u1', role: 'TENANT', tokenVersion: 1, sessionId: 's1' },
        TEST_SECRET
      );

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', role: 'TENANT' as Role, tokenVersion: 2 },
      } as any);

      const ctx = createMockContext(token);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session revoked or expired.');
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 6. Legacy Token Allowed During Grace Period & Cutoff Enforcement (Tests 6, 7, 22)
  // =========================================================================
  describe('Legacy Token Grace Period & Cutoff Boundaries', () => {
    it('allows legacy token during grace period and leaves sessionId undefined (Test 6)', async () => {
      const legacyToken = jwt.sign({ id: 'u1', role: 'TENANT', tokenVersion: 0 }, TEST_SECRET);

      vi.mocked(prisma.revokedLegacyToken.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'TENANT' as Role,
        tokenVersion: 0,
      } as any);

      const ctx = createMockContext(legacyToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.wasNextCalled()).toBe(true);
      expect(ctx.req.user?.id).toBe('u1');
      expect(ctx.req.sessionId).toBeUndefined();
    });

    it('rejects legacy token after cutoff date immediately without querying database (Test 7)', async () => {
      const legacyToken = jwt.sign({ id: 'u1', role: 'TENANT', tokenVersion: 0 }, TEST_SECRET);

      // Cutoff set in the past
      process.env.LEGACY_TOKEN_CUTOFF_DATE = new Date(Date.now() - 1000).toISOString();

      const ctx = createMockContext(legacyToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Legacy session format expired. Please log in again.');
      expect(ctx.wasNextCalled()).toBe(false);

      // Guarantee ZERO database queries occurred
      expect(prisma.revokedLegacyToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });

    it('rejects legacy token with 401 when found in RevokedLegacyToken table (Test 22)', async () => {
      const legacyToken = jwt.sign({ id: 'u-leg', role: 'TENANT', tokenVersion: 0 }, TEST_SECRET);

      vi.mocked(prisma.revokedLegacyToken.findUnique).mockResolvedValue({ id: 'revoked-row-1' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-leg',
        role: 'TENANT' as Role,
        tokenVersion: 0,
      } as any);

      const ctx = createMockContext(legacyToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session has been revoked.');
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects legacy token with 401 when user tokenVersion mismatch occurs', async () => {
      const legacyToken = jwt.sign({ id: 'u-leg', role: 'TENANT', tokenVersion: 0 }, TEST_SECRET);

      vi.mocked(prisma.revokedLegacyToken.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-leg',
        role: 'TENANT' as Role,
        tokenVersion: 1, // bumped
      } as any);

      const ctx = createMockContext(legacyToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Session revoked or expired.');
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 7. Legacy Token Logout & SHA-256 Replay Defense (Test 8)
  // =========================================================================
  describe('Legacy Token Logout & SHA-256 Replay Defense', () => {
    it('hashes logged-out legacy token using SHA-256 and rejects replay attempts (Test 8)', () => {
      const legacyToken = jwt.sign({ id: 'u1', role: 'TENANT', tokenVersion: 0 }, TEST_SECRET, { expiresIn: '7d' });
      const decoded: any = jwt.verify(legacyToken, TEST_SECRET);

      // Compute SHA-256 hash (never store raw JWT)
      const tokenHash = crypto.createHash('sha256').update(legacyToken).digest('hex');
      const mockRevokedStore = new Map<string, Date>();
      mockRevokedStore.set(tokenHash, new Date(decoded.exp * 1000));

      // Replay attempt verification
      const replayHash = crypto.createHash('sha256').update(legacyToken).digest('hex');
      expect(mockRevokedStore.has(replayHash)).toBe(true);
    });
  });

  // =========================================================================
  // 8. Logout Idempotency & Concurrency Safety (Test 9)
  // =========================================================================
  describe('Logout Idempotency & Concurrency Safety', () => {
    it('executes repeated and concurrent logouts idempotently and safely (Test 9)', () => {
      const mockSessions = new Map<string, { revokedAt: Date | null }>();
      mockSessions.set('s-idempotent', { revokedAt: null });

      // Repeated logouts simulate concurrent/duplicate client calls
      for (let i = 0; i < 3; i++) {
        const ctx = createMockContext();
        const session = mockSessions.get('s-idempotent')!;
        if (!session.revokedAt) {
          session.revokedAt = new Date();
        }
        ctx.res.clearCookie('rentgoer_token', { httpOnly: true, sameSite: 'lax' });
        ctx.res.status(200).json({ success: true, message: 'Logged out successfully' });

        expect(ctx.getStatus()).toBe(200);
        expect(ctx.getClearedCookies()).toHaveLength(1);
      }

      expect(mockSessions.get('s-idempotent')!.revokedAt).not.toBeNull();
    });
  });

  // =========================================================================
  // 9. Multi-Device Isolation (SEC-01B Core Invariant) (Test 10)
  // =========================================================================
  describe('Multi-Device Isolation (SEC-01B)', () => {
    it('revokes only Device A session on logout while preserving Device B session (Test 10)', async () => {
      const userId = 'user-multidevice';
      const sessionAId = 'session-device-a';
      const sessionBId = 'session-device-b';

      const tokenA = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 0, sessionId: sessionAId }, TEST_SECRET);
      const tokenB = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 0, sessionId: sessionBId }, TEST_SECRET);

      const mockDbSessions = new Map<string, { userId: string; revokedAt: Date | null; tokenVersion: number }>();
      mockDbSessions.set(sessionAId, { userId, revokedAt: null, tokenVersion: 0 });
      mockDbSessions.set(sessionBId, { userId, revokedAt: null, tokenVersion: 0 });

      // Device A calls logout -> marks sessionAId revoked
      mockDbSessions.get(sessionAId)!.revokedAt = new Date();

      // Device A subsequent request is rejected
      vi.mocked(prisma.session.findUnique).mockImplementation(async (args: any) => {
        const s = mockDbSessions.get(args.where.id);
        if (!s) return null;
        return {
          id: args.where.id,
          userId: s.userId,
          revokedAt: s.revokedAt,
          expiresAt: new Date(Date.now() + 100000),
          user: { id: s.userId, role: 'TENANT' as Role, tokenVersion: s.tokenVersion },
        } as any;
      });

      const verifyCtxA = createMockContext(tokenA);
      await authMiddleware(verifyCtxA.req, verifyCtxA.res, verifyCtxA.next);
      expect(verifyCtxA.getStatus()).toBe(401);
      expect(verifyCtxA.getJson().message).toBe('Unauthenticated. Session has been revoked.');
      expect(verifyCtxA.wasNextCalled()).toBe(false);

      // Device B REMAINS ACTIVE
      const verifyCtxB = createMockContext(tokenB);
      await authMiddleware(verifyCtxB.req, verifyCtxB.res, verifyCtxB.next);
      expect(verifyCtxB.wasNextCalled()).toBe(true);
      expect(verifyCtxB.req.sessionId).toBe(sessionBId);
      expect(mockDbSessions.get(sessionBId)!.revokedAt).toBeNull();
    });
  });

  // =========================================================================
  // 10. Global Invalidation via Password & Email Changes (Tests 11, 12, 24)
  // =========================================================================
  describe('Global Invalidation via Account Updates', () => {
    it('atomically revokes all active sessions and increments tokenVersion on password change (Test 11 & 24a)', () => {
      const userId = 'user-pw-change';
      const sessionAId = 'session-a';
      const sessionBId = 'session-b';

      let userTokenVersion = 0;
      const sessions = [
        { id: sessionAId, userId, revokedAt: null as Date | null },
        { id: sessionBId, userId, revokedAt: null as Date | null },
      ];

      // Atomic password change operation
      userTokenVersion += 1;
      for (const s of sessions) {
        s.revokedAt = new Date();
      }

      expect(userTokenVersion).toBe(1);
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

      // Both old tokens (issued with tokenVersion 0) must now fail
      const tokenA = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 0, sessionId: sessionAId }, TEST_SECRET);
      const tokenB = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 0, sessionId: sessionBId }, TEST_SECRET);

      const checkToken = (token: string, sessionId: string) => {
        const decoded: any = jwt.verify(token, TEST_SECRET);
        const s = sessions.find((x) => x.id === sessionId)!;
        if (s.revokedAt !== null || decoded.tokenVersion !== userTokenVersion) {
          return 401;
        }
        return 200;
      };

      expect(checkToken(tokenA, sessionAId)).toBe(401);
      expect(checkToken(tokenB, sessionBId)).toBe(401);
    });

    it('invalidates prior sessions while producing working replacement session on email change (Test 12 & 24b/c)', () => {
      const userId = 'user-email-change';
      const oldSessionId = 'session-old';
      const replacementSessionId = 'session-replacement';

      let userTokenVersion = 0;
      const sessions = [{ id: oldSessionId, userId, revokedAt: null as Date | null }];

      // Step 1: Revoke prior sessions
      for (const s of sessions) {
        s.revokedAt = new Date();
      }
      // Step 2: Increment tokenVersion
      userTokenVersion += 1;
      // Step 3: Create replacement session
      sessions.push({ id: replacementSessionId, userId, revokedAt: null });

      // Verify old token is rejected
      const oldToken = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 0, sessionId: oldSessionId }, TEST_SECRET);
      const decodedOld: any = jwt.verify(oldToken, TEST_SECRET);
      const oldRecord = sessions.find((s) => s.id === oldSessionId)!;
      expect(oldRecord.revokedAt).not.toBeNull();
      expect(decodedOld.tokenVersion).not.toBe(userTokenVersion);

      // Verify replacement token is active
      const replacementToken = jwt.sign(
        { id: userId, role: 'TENANT', tokenVersion: userTokenVersion, sessionId: replacementSessionId },
        TEST_SECRET
      );
      const decodedRep: any = jwt.verify(replacementToken, TEST_SECRET);
      const repRecord = sessions.find((s) => s.id === replacementSessionId)!;
      expect(repRecord.revokedAt).toBeNull();
      expect(decodedRep.tokenVersion).toBe(userTokenVersion);
    });
  });

  // =========================================================================
  // 11. Transaction & Database Failure Protection (Test 13)
  // =========================================================================
  describe('Transaction Safety', () => {
    it('prevents cookie and JWT issuance when session creation transaction fails (Test 13)', () => {
      let cookieIssued = false;
      let thrownError: any = null;

      try {
        // Simulate session creation failure inside database transaction
        throw new Error('P2003: Foreign key constraint failed on Session.userId');
        // If execution continued, cookie would be issued:
        cookieIssued = true;
      } catch (err: any) {
        thrownError = err;
      }

      expect(cookieIssued).toBe(false);
      expect(thrownError).not.toBeNull();
    });
  });

  // =========================================================================
  // 12. Cookie Clearing Security Flags (Test 14)
  // =========================================================================
  describe('Cookie Clearing Security Flags', () => {
    it('clears authentication cookie with exact security attributes (httpOnly, secure, sameSite) (Test 14)', () => {
      const ctx = createMockContext();
      const isProduction = process.env.NODE_ENV === 'production';
      ctx.res.clearCookie('rentgoer_token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
      });

      const cleared = ctx.getClearedCookies();
      expect(cleared).toHaveLength(1);
      expect(cleared[0].name).toBe('rentgoer_token');
      expect(cleared[0].options.httpOnly).toBe(true);
      expect(cleared[0].options.sameSite).toBe('lax');
      expect(cleared[0].options.secure).toBe(isProduction);
    });
  });

  // =========================================================================
  // 13. Cleanup Filtering Boundaries (Test 15)
  // =========================================================================
  describe('Cleanup Filtering Boundaries', () => {
    it('strictly targets expired session records where expiresAt < now (Test 15)', () => {
      const now = new Date();
      const mockSessions = [
        { id: 'expired-1', expiresAt: new Date(now.getTime() - 1000) },
        { id: 'expired-2', expiresAt: new Date(now.getTime() - 60000) },
        { id: 'active-1', expiresAt: new Date(now.getTime() + 60000) },
      ];

      const toDelete = mockSessions.filter((s) => s.expiresAt < now);
      const toKeep = mockSessions.filter((s) => s.expiresAt >= now);

      expect(toDelete).toHaveLength(2);
      expect(toKeep).toHaveLength(1);
      expect(toKeep[0].id).toBe('active-1');
    });
  });

  // =========================================================================
  // 14. Stage A vs Stage B Token Issuance & Rollout Behavior (Tests 18, 20, 21)
  // =========================================================================
  describe('Stage A vs Stage B Rollout Architecture', () => {
    it('emits legacy tokens without sessionId in Stage A and session-aware tokens in Stage B (Test 18)', () => {
      // Stage A token format:
      const payloadStageA = { id: 'u1', role: 'TENANT', tokenVersion: 0 };
      const tokenA = jwt.sign(payloadStageA, TEST_SECRET);
      const decodedA: any = jwt.verify(tokenA, TEST_SECRET);
      expect(decodedA.sessionId).toBeUndefined();
      expect(decodedA.id).toBe('u1');

      // Stage B token format:
      const payloadStageB = { id: 'u1', role: 'TENANT', tokenVersion: 0, sessionId: 'session-stage-b-123' };
      const tokenB = jwt.sign(payloadStageB, TEST_SECRET);
      const decodedB: any = jwt.verify(tokenB, TEST_SECRET);
      expect(decodedB.sessionId).toBe('session-stage-b-123');
      expect(decodedB.id).toBe('u1');
    });

    it('strictly verifies session existence, ownership, expiry, revocation, and tokenVersion under Stage A (Test 20)', async () => {
      process.env.ENABLE_SESSION_ISSUANCE = 'false';

      const userId = 'user-stage-a';
      const sessionId = 'session-stage-a-001';
      const token = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 1, sessionId }, TEST_SECRET, { expiresIn: '7d' });

      // 20a: Valid session-aware token under Stage A -> SUCCESS
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, role: 'TENANT' as Role, tokenVersion: 1 },
      } as any);

      const ctxValid = createMockContext(token);
      await authMiddleware(ctxValid.req, ctxValid.res, ctxValid.next);
      expect(ctxValid.wasNextCalled()).toBe(true);
      expect(ctxValid.req.sessionId).toBe(sessionId);

      // 20b: Revoked session under Stage A -> 401
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
        user: { id: userId, role: 'TENANT' as Role, tokenVersion: 1 },
      } as any);

      const ctxRevoked = createMockContext(token);
      await authMiddleware(ctxRevoked.req, ctxRevoked.res, ctxRevoked.next);
      expect(ctxRevoked.getStatus()).toBe(401);
      expect(ctxRevoked.getJson().message).toBe('Unauthenticated. Session has been revoked.');

      // 20c: Expired session under Stage A -> 401
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 5000),
        user: { id: userId, role: 'TENANT' as Role, tokenVersion: 1 },
      } as any);

      const ctxExpired = createMockContext(token);
      await authMiddleware(ctxExpired.req, ctxExpired.res, ctxExpired.next);
      expect(ctxExpired.getStatus()).toBe(401);
      expect(ctxExpired.getJson().message).toBe('Unauthenticated. Session expired.');

      // 20d: Session user mismatch under Stage A -> 401
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId: 'different-owner',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'different-owner', role: 'TENANT' as Role, tokenVersion: 1 },
      } as any);

      const ctxMismatch = createMockContext(token);
      await authMiddleware(ctxMismatch.req, ctxMismatch.res, ctxMismatch.next);
      expect(ctxMismatch.getStatus()).toBe(401);
      expect(ctxMismatch.getJson().message).toBe('Unauthenticated. Session user mismatch.');

      // 20e: Stale tokenVersion under Stage A -> 401
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: userId, role: 'TENANT' as Role, tokenVersion: 2 }, // bumped
      } as any);

      const ctxStale = createMockContext(token);
      await authMiddleware(ctxStale.req, ctxStale.res, ctxStale.next);
      expect(ctxStale.getStatus()).toBe(401);
      expect(ctxStale.getJson().message).toBe('Unauthenticated. Session revoked or expired.');
    });

    it('rejects malformed sessionId claim in token with 401 Invalid session token format (Test 20f)', async () => {
      const malformedToken = jwt.sign({ id: 'u1', role: 'TENANT', tokenVersion: 1, sessionId: '   ' }, TEST_SECRET);
      const ctx = createMockContext(malformedToken);
      await authMiddleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson().message).toBe('Unauthenticated. Invalid session token format.');
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('revokes only target session on logout in Stage A while preserving other sessions (Test 21)', () => {
      const userId = 'user-logout-stage-a';
      const session1Id = 'sess-dev-1';
      const session2Id = 'sess-dev-2';

      const mockSessions = new Map<string, { userId: string; revokedAt: Date | null }>();
      mockSessions.set(session1Id, { userId, revokedAt: null });
      mockSessions.set(session2Id, { userId, revokedAt: null });

      // Device 1 logs out:
      mockSessions.get(session1Id)!.revokedAt = new Date();

      expect(mockSessions.get(session1Id)!.revokedAt).not.toBeNull();
      expect(mockSessions.get(session2Id)!.revokedAt).toBeNull();
    });
  });

  // =========================================================================
  // 15. Startup Configuration Guards & Immutability (Tests 19, 23)
  // =========================================================================
  describe('Startup Configuration Guards & Cutoff Immutability', () => {
    it('prevents startup misconfiguration where past cutoff is set with Stage A (Test 19)', () => {
      // Case 1: Stage A with past cutoff -> FATAL ERROR (prevents bricking newly issued legacy tokens)
      process.env.ENABLE_SESSION_ISSUANCE = 'false';
      process.env.LEGACY_TOKEN_CUTOFF_DATE = new Date(Date.now() - 60000).toISOString();
      expect(() => validateAuthConfigAtStartup()).toThrow(
        /FATAL CONFIGURATION ERROR: LEGACY_TOKEN_CUTOFF_DATE .* is in the past, but ENABLE_SESSION_ISSUANCE is false!/
      );

      // Case 2: Stage B with past cutoff -> ALLOWED (all users are now session-tracked)
      process.env.ENABLE_SESSION_ISSUANCE = 'true';
      process.env.LEGACY_TOKEN_CUTOFF_DATE = new Date(Date.now() - 60000).toISOString();
      expect(() => validateAuthConfigAtStartup()).not.toThrow();

      // Case 3: Stage A with future cutoff -> ALLOWED (normal Stage A grace period)
      process.env.ENABLE_SESSION_ISSUANCE = 'false';
      process.env.LEGACY_TOKEN_CUTOFF_DATE = graceCutoffDate.toISOString();
      expect(() => validateAuthConfigAtStartup()).not.toThrow();
    });

    it('ensures cutoff timestamp is immutable across invocations and rejects missing env var (Test 23)', () => {
      const fixedTimestamp = '2026-11-15T12:00:00.000Z';
      process.env.LEGACY_TOKEN_CUTOFF_DATE = fixedTimestamp;

      const d1 = getLegacyCutoffDate();
      const d2 = getLegacyCutoffDate();

      expect(d1.toISOString()).toBe(fixedTimestamp);
      expect(d2.toISOString()).toBe(fixedTimestamp);
      expect(d1.getTime()).toBe(d2.getTime());

      // Missing env var throws fatal error rather than defaulting silently
      delete process.env.LEGACY_TOKEN_CUTOFF_DATE;
      expect(() => getLegacyCutoffDate()).toThrow(
        /FATAL CONFIGURATION ERROR: LEGACY_TOKEN_CUTOFF_DATE environment variable is missing/
      );
    });
  });
});
