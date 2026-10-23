import { describe, it, expect } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../../src/middleware/role.middleware';

// Helper to create mock Express Request, Response, and NextFunction
function createMockReqRes(options: { user?: { id: string; role: string } | null } = {}) {
  const req: any = {
    user: options.user === null ? undefined : options.user,
  };
  let responseStatus = 200;
  let responseJson: any = null;
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
    wasNextCalled: () => nextCalled,
  };
}

describe('Role Authorization Middleware Unit Tests (requireRole)', () => {
  // =========================================================================
  // 1. Unauthenticated Requests
  // =========================================================================
  describe('Unauthenticated Request Handling', () => {
    it('returns 401 Unauthenticated when req.user is undefined', () => {
      const middleware = requireRole('ADMIN');
      const ctx = createMockReqRes({ user: undefined });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('returns 401 Unauthenticated when req.user is null', () => {
      const middleware = requireRole('TENANT', 'OWNER');
      const ctx = createMockReqRes({ user: null });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Unauthenticated',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 2. Single Allowed Role
  // =========================================================================
  describe('Single Role Verification', () => {
    it('allows access and calls next() when user role matches the required role', () => {
      const middleware = requireRole('ADMIN');
      const ctx = createMockReqRes({ user: { id: 'admin-1', role: 'ADMIN' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.wasNextCalled()).toBe(true);
      expect(ctx.getStatus()).toBe(200); // untouched status
    });

    it('rejects with 403 Forbidden when user role does not match the required role', () => {
      const middleware = requireRole('ADMIN');
      const ctx = createMockReqRes({ user: { id: 'tenant-1', role: 'TENANT' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 3. Multiple Allowed Roles
  // =========================================================================
  describe('Multiple Allowed Roles Verification', () => {
    it('allows access and calls next() when user role matches any one of the allowed roles', () => {
      const middleware = requireRole('OWNER', 'ADMIN');

      // Test OWNER match
      const ownerCtx = createMockReqRes({ user: { id: 'owner-1', role: 'OWNER' } });
      middleware(ownerCtx.req, ownerCtx.res, ownerCtx.next);
      expect(ownerCtx.wasNextCalled()).toBe(true);

      // Test ADMIN match
      const adminCtx = createMockReqRes({ user: { id: 'admin-1', role: 'ADMIN' } });
      middleware(adminCtx.req, adminCtx.res, adminCtx.next);
      expect(adminCtx.wasNextCalled()).toBe(true);
    });

    it('rejects with 403 Forbidden when user role is not in the multiple allowed roles list', () => {
      const middleware = requireRole('OWNER', 'ADMIN');
      const ctx = createMockReqRes({ user: { id: 'tenant-1', role: 'TENANT' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });

  // =========================================================================
  // 4. Boundary and Edge Cases
  // =========================================================================
  describe('Boundary and Edge Cases', () => {
    it('enforces strict case sensitivity for role matching', () => {
      const middleware = requireRole('ADMIN');
      // Lowercase 'admin' should NOT match 'ADMIN'
      const ctx = createMockReqRes({ user: { id: 'admin-1', role: 'admin' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects with 403 Forbidden when user.role is empty string', () => {
      const middleware = requireRole('TENANT');
      const ctx = createMockReqRes({ user: { id: 'u1', role: '' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.wasNextCalled()).toBe(false);
    });

    it('rejects any authenticated user with 403 Forbidden if requireRole is configured with no roles', () => {
      // Degenerate configuration: requireRole() with 0 arguments
      const middleware = requireRole();
      const ctx = createMockReqRes({ user: { id: 'admin-1', role: 'ADMIN' } });

      middleware(ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
      expect(ctx.wasNextCalled()).toBe(false);
    });
  });
});
