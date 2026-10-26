import { describe, it, expect } from 'vitest';
import {
  isProfileComplete,
  getProfileCompletionStatus,
  MOVE_IN_TIMELINE_CHOICES,
} from '@/lib/profile';
import { User } from '@/context/AuthContext';

describe('Profile completion utility (getProfileCompletionStatus & isProfileComplete)', () => {
  const baseUser: User = {
    id: 'usr-tenant-1',
    name: 'Jane Tenant',
    email: 'jane@example.com',
    role: 'TENANT',
  };

  const fullyCompleteUser: User = {
    id: 'usr-tenant-1',
    name: 'Jane Tenant',
    email: 'jane@example.com',
    role: 'TENANT',
    avatarUrl: null, // Optional field
    phone: '+91 9876543210',
    bio: 'Software engineer looking for a quiet 1BHK or 2BHK near tech parks.',
    preferredCity: 'Bangalore, Indiranagar',
    monthlyBudget: 35000,
    moveInTimeline: 'Within one month',
  };

  describe('Empty and null user profiles', () => {
    it('returns 0% completion and false for null or undefined user', () => {
      const nullStatus = getProfileCompletionStatus(null);
      expect(nullStatus.isComplete).toBe(false);
      expect(nullStatus.completedCount).toBe(0);
      expect(nullStatus.percentage).toBe(0);
      expect(nullStatus.totalItems).toBe(5);
      expect(nullStatus.missingItems).toHaveLength(5);
      expect(isProfileComplete(null)).toBe(false);

      const undefinedStatus = getProfileCompletionStatus(undefined);
      expect(undefinedStatus.isComplete).toBe(false);
      expect(undefinedStatus.completedCount).toBe(0);
      expect(undefinedStatus.percentage).toBe(0);
      expect(isProfileComplete(undefined)).toBe(false);
    });

    it('does not treat registration fields alone (name, email, role) as completed profile', () => {
      // Existing user whose new renter fields are null/undefined
      const registeredOnlyUser: User = {
        ...baseUser,
        phone: null,
        bio: null,
        preferredCity: null,
        monthlyBudget: null,
        moveInTimeline: null,
      };

      const status = getProfileCompletionStatus(registeredOnlyUser);
      expect(status.isComplete).toBe(false);
      expect(status.completedCount).toBe(0);
      expect(status.percentage).toBe(0);
      expect(status.missingItems.map((item) => item.id)).toEqual([
        'phone',
        'bio',
        'preferredCity',
        'monthlyBudget',
        'moveInTimeline',
      ]);
      expect(isProfileComplete(registeredOnlyUser)).toBe(false);
    });

    it('handles empty profile with whitespace-only or empty strings', () => {
      const emptyUser: User = {
        ...baseUser,
        phone: '   ',
        bio: '',
        preferredCity: '  ',
        monthlyBudget: null,
        moveInTimeline: '',
      };

      const status = getProfileCompletionStatus(emptyUser);
      expect(status.isComplete).toBe(false);
      expect(status.completedCount).toBe(0);
      expect(status.percentage).toBe(0);
      expect(status.missingItems).toHaveLength(5);
      expect(isProfileComplete(emptyUser)).toBe(false);
    });
  });

  describe('Partial profiles and exact missing items', () => {
    it('returns 2 of 5 (40%) and identifies exact missing items', () => {
      const partialUser: User = {
        ...baseUser,
        phone: '+91 9876543210',
        bio: 'Responsible tenant working in healthcare.',
        preferredCity: null,
        monthlyBudget: null,
        moveInTimeline: null,
      };

      const status = getProfileCompletionStatus(partialUser);
      expect(status.isComplete).toBe(false);
      expect(status.completedCount).toBe(2);
      expect(status.totalItems).toBe(5);
      expect(status.percentage).toBe(40);
      expect(status.missingItems.map((item) => item.id)).toEqual([
        'preferredCity',
        'monthlyBudget',
        'moveInTimeline',
      ]);
      expect(isProfileComplete(partialUser)).toBe(false);
    });

    it('returns 4 of 5 (80%) when only budget is missing', () => {
      const userMissingBudget: User = {
        ...fullyCompleteUser,
        monthlyBudget: null,
      };

      const status = getProfileCompletionStatus(userMissingBudget);
      expect(status.isComplete).toBe(false);
      expect(status.completedCount).toBe(4);
      expect(status.percentage).toBe(80);
      expect(status.missingItems).toHaveLength(1);
      expect(status.missingItems[0].id).toBe('monthlyBudget');
      expect(isProfileComplete(userMissingBudget)).toBe(false);
    });

    it('returns 4 of 5 (80%) when only move-in timeline is missing', () => {
      const userMissingTimeline: User = {
        ...fullyCompleteUser,
        moveInTimeline: null,
      };

      const status = getProfileCompletionStatus(userMissingTimeline);
      expect(status.isComplete).toBe(false);
      expect(status.completedCount).toBe(4);
      expect(status.percentage).toBe(80);
      expect(status.missingItems).toHaveLength(1);
      expect(status.missingItems[0].id).toBe('moveInTimeline');
    });
  });

  describe('Input validation rules for checklist items', () => {
    describe('1. Contact phone number', () => {
      it('fails when phone is malformed or too short', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: '123' }).missingItems.some((i) => i.id === 'phone')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: 'phone-number' }).missingItems.some((i) => i.id === 'phone')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: '  +12  ' }).missingItems.some((i) => i.id === 'phone')).toBe(true);
      });

      it('succeeds with valid international and local phone numbers', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: '+1 (555) 123-4567' }).checklist.find((i) => i.id === 'phone')?.isComplete).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: '+919876543210' }).checklist.find((i) => i.id === 'phone')?.isComplete).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, phone: '9876543210' }).checklist.find((i) => i.id === 'phone')?.isComplete).toBe(true);
      });
    });

    describe('2. Renter introduction / About me', () => {
      it('fails when bio is shorter than 10 characters or whitespace-only', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, bio: 'Hello' }).missingItems.some((i) => i.id === 'bio')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, bio: '          ' }).missingItems.some((i) => i.id === 'bio')).toBe(true);
      });

      it('fails when bio exceeds 500 characters', () => {
        const tooLongBio = 'a'.repeat(501);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, bio: tooLongBio }).missingItems.some((i) => i.id === 'bio')).toBe(true);
      });

      it('succeeds with valid 10-500 character bio', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, bio: 'Quiet professional tenant.' }).checklist.find((i) => i.id === 'bio')?.isComplete).toBe(true);
      });
    });

    describe('3. Preferred rental city or locality', () => {
      it('fails when preferredCity is shorter than 2 characters or whitespace-only', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, preferredCity: 'A' }).missingItems.some((i) => i.id === 'preferredCity')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, preferredCity: '   ' }).missingItems.some((i) => i.id === 'preferredCity')).toBe(true);
      });

      it('fails when preferredCity exceeds 100 characters', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, preferredCity: 'C'.repeat(101) }).missingItems.some((i) => i.id === 'preferredCity')).toBe(true);
      });

      it('succeeds with valid city name', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, preferredCity: 'Pune' }).checklist.find((i) => i.id === 'preferredCity')?.isComplete).toBe(true);
      });
    });

    describe('4. Monthly rental budget', () => {
      it('fails when budget is 0, negative, NaN, or exceeds 10,000,000', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: 0 }).missingItems.some((i) => i.id === 'monthlyBudget')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: -1500 }).missingItems.some((i) => i.id === 'monthlyBudget')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: 15000000 }).missingItems.some((i) => i.id === 'monthlyBudget')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: 'not-a-number' as unknown as number }).missingItems.some((i) => i.id === 'monthlyBudget')).toBe(true);
      });

      it('succeeds with positive numbers within valid range', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: 25000 }).checklist.find((i) => i.id === 'monthlyBudget')?.isComplete).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, monthlyBudget: '30000' as unknown as number }).checklist.find((i) => i.id === 'monthlyBudget')?.isComplete).toBe(true);
      });
    });

    describe('5. Expected move-in timeline', () => {
      it('fails when moveInTimeline is not one of the allowed choices', () => {
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, moveInTimeline: 'Next Year' }).missingItems.some((i) => i.id === 'moveInTimeline')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, moveInTimeline: 'Whenever' }).missingItems.some((i) => i.id === 'moveInTimeline')).toBe(true);
        expect(getProfileCompletionStatus({ ...fullyCompleteUser, moveInTimeline: '' }).missingItems.some((i) => i.id === 'moveInTimeline')).toBe(true);
      });

      it('succeeds for every valid choice in MOVE_IN_TIMELINE_CHOICES', () => {
        for (const choice of MOVE_IN_TIMELINE_CHOICES) {
          const status = getProfileCompletionStatus({ ...fullyCompleteUser, moveInTimeline: choice });
          expect(status.checklist.find((i) => i.id === 'moveInTimeline')?.isComplete).toBe(true);
        }
      });
    });
  });

  describe('Valid complete profile', () => {
    it('returns 100%, isComplete: true, and empty missingItems for valid complete profile', () => {
      const status = getProfileCompletionStatus(fullyCompleteUser);
      expect(status.isComplete).toBe(true);
      expect(status.completedCount).toBe(5);
      expect(status.totalItems).toBe(5);
      expect(status.percentage).toBe(100);
      expect(status.missingItems).toHaveLength(0);
      expect(isProfileComplete(fullyCompleteUser)).toBe(true);
    });

    it('optional fields (like avatarUrl) do NOT block completion', () => {
      // avatarUrl is null
      expect(isProfileComplete({ ...fullyCompleteUser, avatarUrl: null })).toBe(true);
      // avatarUrl is undefined
      expect(isProfileComplete({ ...fullyCompleteUser, avatarUrl: undefined })).toBe(true);
      // avatarUrl is set
      expect(isProfileComplete({ ...fullyCompleteUser, avatarUrl: 'https://example.com/photo.jpg' })).toBe(true);
    });
  });
});
