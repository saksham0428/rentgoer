import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { updateProfile, getMe } from '../../src/controllers/auth.controller';
import { prisma } from '../../src/lib/prisma';

// Mock prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

function createMockContext(userId?: string, body: any = {}) {
  const req: any = {
    user: userId ? { id: userId, role: 'TENANT' } : undefined,
    body,
  };
  let statusCode = 200;
  let jsonResponse: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonResponse = data;
      return res;
    },
  };

  return {
    req: req as Request,
    res: res as Response,
    getStatusCode: () => statusCode,
    getJsonResponse: () => jsonResponse,
  };
}

describe('Renter Profile Preferences & updateProfile Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication guard', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const { req, res, getStatusCode, getJsonResponse } = createMockContext(undefined, {
        name: 'Jane Tenant',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(401);
      expect(getJsonResponse().success).toBe(false);
      expect(getJsonResponse().message).toBe('Unauthenticated');
    });
  });

  describe('Validation rules', () => {
    it('rejects names shorter than 2 characters or longer than 60 characters', async () => {
      const { req: reqShort, res: resShort, getStatusCode: getCodeShort } = createMockContext('usr-1', {
        name: 'A',
      });
      await updateProfile(reqShort, resShort);
      expect(getCodeShort()).toBe(400);

      const { req: reqLong, res: resLong, getStatusCode: getCodeLong } = createMockContext('usr-1', {
        name: 'B'.repeat(61),
      });
      await updateProfile(reqLong, resLong);
      expect(getCodeLong()).toBe(400);
    });

    it('rejects malformed phone numbers', async () => {
      const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-1', {
        name: 'Valid Name',
        phone: 'invalid-phone-letters',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toMatch(/Invalid phone number format/i);
    });

    it('rejects phone numbers with fewer than 7 digits', async () => {
      const { req, res, getStatusCode } = createMockContext('usr-1', {
        name: 'Valid Name',
        phone: '12345',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(400);
    });

    it('rejects bio exceeding 500 characters', async () => {
      const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-1', {
        name: 'Valid Name',
        bio: 'x'.repeat(501),
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toMatch(/cannot exceed 500 characters/i);
    });

    it('rejects preferredCity shorter than 2 or longer than 100 characters', async () => {
      const { req: reqShort, res: resShort, getStatusCode: getCodeShort } = createMockContext('usr-1', {
        name: 'Valid Name',
        preferredCity: 'A',
      });
      await updateProfile(reqShort, resShort);
      expect(getCodeShort()).toBe(400);

      const { req: reqLong, res: resLong, getStatusCode: getCodeLong } = createMockContext('usr-1', {
        name: 'Valid Name',
        preferredCity: 'C'.repeat(101),
      });
      await updateProfile(reqLong, resLong);
      expect(getCodeLong()).toBe(400);
    });

    it('rejects invalid monthly budgets (negative, zero, NaN, or > 10,000,000)', async () => {
      for (const invalidBudget of [0, -1000, 10000001, 'not-a-number']) {
        const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-1', {
          name: 'Valid Name',
          monthlyBudget: invalidBudget,
        });

        await updateProfile(req, res);

        expect(getStatusCode()).toBe(400);
        expect(getJsonResponse().message).toMatch(/Monthly budget must be a positive number/i);
      }
    });

    it('rejects invalid moveInTimeline choices', async () => {
      const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-1', {
        name: 'Valid Name',
        moveInTimeline: 'Next Year',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toMatch(/Move-in timeline must be one of/i);
    });
  });

  describe('Successful update & persistence', () => {
    it('sanitizes inputs, updates user in database, and returns 200 with updated fields', async () => {
      const mockUpdatedUser = {
        id: 'usr-1',
        name: 'Jane Renter',
        email: 'jane@example.com',
        role: 'TENANT',
        avatarUrl: null,
        phone: '+91 9876543210',
        bio: 'Quiet software engineer looking for a flat.',
        preferredCity: 'Bangalore, Indiranagar',
        monthlyBudget: 35000,
        moveInTimeline: 'Within one month',
        isVerified: false,
        createdAt: new Date(),
      };

      (prisma.user.update as any).mockResolvedValue(mockUpdatedUser);

      const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-1', {
        name: '  Jane Renter  ',
        phone: '  +91 9876543210  ',
        bio: '  Quiet software engineer looking for a flat.  ',
        preferredCity: '  Bangalore, Indiranagar  ',
        monthlyBudget: '35000',
        moveInTimeline: 'Within one month',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(200);
      expect(getJsonResponse().success).toBe(true);
      expect(getJsonResponse().user).toEqual(mockUpdatedUser);

      // Verify prisma.user.update was called with sanitized values
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          name: 'Jane Renter',
          phone: '+91 9876543210',
          bio: 'Quiet software engineer looking for a flat.',
          preferredCity: 'Bangalore, Indiranagar',
          monthlyBudget: 35000,
          moveInTimeline: 'Within one month',
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          phone: true,
          bio: true,
          preferredCity: true,
          monthlyBudget: true,
          moveInTimeline: true,
        }),
      });
    });

    it('allows clearing optional renter fields to null', async () => {
      (prisma.user.update as any).mockResolvedValue({
        id: 'usr-1',
        name: 'Jane Renter',
        phone: null,
        bio: null,
        preferredCity: null,
        monthlyBudget: null,
        moveInTimeline: null,
      });

      const { req, res, getStatusCode } = createMockContext('usr-1', {
        name: 'Jane Renter',
        phone: '',
        bio: '',
        preferredCity: '',
        monthlyBudget: '',
        moveInTimeline: '',
      });

      await updateProfile(req, res);

      expect(getStatusCode()).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Jane Renter',
            phone: null,
            bio: null,
            preferredCity: null,
            monthlyBudget: null,
            moveInTimeline: null,
          },
        })
      );
    });
  });

  describe('getMe controller for existing users', () => {
    it('returns null for new renter preference fields on existing users without errors', async () => {
      const existingLegacyUser = {
        id: 'usr-legacy',
        name: 'Legacy User',
        email: 'legacy@example.com',
        role: 'TENANT',
        avatarUrl: null,
        phone: null,
        bio: null,
        preferredCity: null,
        monthlyBudget: null,
        moveInTimeline: null,
        isVerified: false,
        createdAt: new Date(),
      };

      (prisma.user.findUnique as any).mockResolvedValue(existingLegacyUser);

      const { req, res, getStatusCode, getJsonResponse } = createMockContext('usr-legacy');

      await getMe(req, res);

      expect(getStatusCode()).toBe(200);
      expect(getJsonResponse().success).toBe(true);
      expect(getJsonResponse().user.bio).toBeNull();
      expect(getJsonResponse().user.preferredCity).toBeNull();
      expect(getJsonResponse().user.monthlyBudget).toBeNull();
      expect(getJsonResponse().user.moveInTimeline).toBeNull();
    });
  });
});
