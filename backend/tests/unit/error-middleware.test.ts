import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/error.middleware';

// Helper to create mock Express Request, Response, and NextFunction
function createMockReqRes(options: { headersSent?: boolean; method?: string; url?: string } = {}) {
  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/api/test',
  };
  let responseStatus = 200;
  let responseJson: any = null;
  let nextCalledWith: any = undefined;

  const res: any = {
    headersSent: options.headersSent || false,
    status(code: number) {
      responseStatus = code;
      return res;
    },
    json(data: any) {
      responseJson = data;
      return res;
    },
  };

  const next = (err?: any) => {
    nextCalledWith = err;
  };

  return {
    req: req as Request,
    res: res as Response,
    next: next as NextFunction,
    getStatus: () => responseStatus,
    getJson: () => responseJson,
    getNextCalledWith: () => nextCalledWith,
  };
}

describe('Error Handling Middleware Unit Tests (errorHandler)', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Suppress console.error output during tests while spying on logged content
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // =========================================================================
  // 1. Delegation when Headers Already Sent
  // =========================================================================
  describe('Headers Already Sent Delegation', () => {
    it('delegates to next(err) without sending a second response when res.headersSent is true', () => {
      const ctx = createMockReqRes({ headersSent: true });
      const testError = new Error('Late streaming socket failure');

      errorHandler(testError, ctx.req, ctx.res, ctx.next);

      // Must delegate to Express default error handler
      expect(ctx.getNextCalledWith()).toBe(testError);
      // Must not call res.json or override status
      expect(ctx.getJson()).toBeNull();
    });
  });

  // =========================================================================
  // 2. Sanitization of Unexpected 500 / Internal Errors
  // =========================================================================
  describe('Internal Error Sanitization & Leakage Prevention', () => {
    it('sanitizes unexpected internal errors to "Internal server error" without leaking stack trace or secrets', () => {
      const ctx = createMockReqRes({ method: 'POST', url: '/api/properties' });
      const sensitiveError = new Error(
        'FATAL: password authentication failed for user "postgres_superadmin" at db.internal.local:5432\n    at Connection.parseE (/node_modules/pg/lib/connection.js:123:45)'
      );

      errorHandler(sensitiveError, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(500);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Internal server error',
      });

      // Confirm no sensitive tokens, database hostnames, or paths are in the client response
      const clientMessage = ctx.getJson().message;
      expect(clientMessage).not.toContain('postgres_superadmin');
      expect(clientMessage).not.toContain('db.internal.local');
      expect(clientMessage).not.toContain('node_modules');
    });

    it('defaults status to 500 when error object has no status property', () => {
      const ctx = createMockReqRes();
      const genericError = new Error('Unexpected undefined is not a function');

      errorHandler(genericError, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(500);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Internal server error',
      });
    });

    it('sanitizes explicit 500-level errors (status >= 500) to "Internal server error"', () => {
      const ctx500 = createMockReqRes();
      errorHandler({ status: 500, message: 'Custom server crash details' }, ctx500.req, ctx500.res, ctx500.next);
      expect(ctx500.getStatus()).toBe(500);
      expect(ctx500.getJson().message).toBe('Internal server error');

      const ctx502 = createMockReqRes();
      errorHandler({ status: 502, message: 'Upstream microservice timed out' }, ctx502.req, ctx502.res, ctx502.next);
      expect(ctx502.getStatus()).toBe(502);
      expect(ctx502.getJson().message).toBe('Internal server error');

      const ctx503 = createMockReqRes();
      errorHandler({ status: 503, message: 'Connection pool exhausted' }, ctx503.req, ctx503.res, ctx503.next);
      expect(ctx503.getStatus()).toBe(503);
      expect(ctx503.getJson().message).toBe('Internal server error');
    });
  });

  // =========================================================================
  // 3. Client Error Message Preservation (Status < 500)
  // =========================================================================
  describe('Client Error Message Preservation (< 500)', () => {
    it('preserves status and message for 400 Bad Request client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 400, message: 'Invalid minRent parameter' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(400);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Invalid minRent parameter',
      });
    });

    it('preserves status and message for 401 Unauthenticated client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 401, message: 'Token expired' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(401);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Token expired',
      });
    });

    it('preserves status and message for 403 Forbidden client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 403, message: 'Forbidden. Insufficient permissions.' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(403);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
    });

    it('preserves status and message for 404 Not Found client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 404, message: 'Property listing not found' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(404);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Property listing not found',
      });
    });

    it('preserves status and message for 409 Conflict client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 409, message: 'Email address already registered' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(409);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Email address already registered',
      });
    });

    it('preserves status and message for 422 Unprocessable Entity client errors', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 422, message: 'Validation failed for bedrooms field' }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(422);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Validation failed for bedrooms field',
      });
    });
  });

  // =========================================================================
  // 4. Boundary and Fallback Cases
  // =========================================================================
  describe('Boundary and Fallback Cases', () => {
    it('defaults message to "Internal server error" when client error status < 500 lacks a message', () => {
      const ctx = createMockReqRes();
      errorHandler({ status: 400 }, ctx.req, ctx.res, ctx.next);

      expect(ctx.getStatus()).toBe(400);
      expect(ctx.getJson()).toEqual({
        success: false,
        message: 'Internal server error',
      });
    });

    it('safely handles primitive error strings and empty error objects', () => {
      const ctxString = createMockReqRes();
      expect(() => {
        errorHandler('Raw primitive string error', ctxString.req, ctxString.res, ctxString.next);
      }).not.toThrow();
      expect(ctxString.getStatus()).toBe(500);
      expect(ctxString.getJson().message).toBe('Internal server error');

      const ctxEmptyObj = createMockReqRes();
      expect(() => {
        errorHandler({}, ctxEmptyObj.req, ctxEmptyObj.res, ctxEmptyObj.next);
      }).not.toThrow();
      expect(ctxEmptyObj.getStatus()).toBe(500);
      expect(ctxEmptyObj.getJson().message).toBe('Internal server error');
    });

    it('logs detailed request information and the raw error on the server side', () => {
      const ctx = createMockReqRes({ method: 'DELETE', url: '/api/properties/prop-101' });
      const testErr = new Error('Database constraint violation');

      errorHandler(testErr, ctx.req, ctx.res, ctx.next);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] DELETE /api/properties/prop-101');
      expect(consoleErrorSpy).toHaveBeenCalledWith(testErr);
    });
  });
});
