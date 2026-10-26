import { User } from '@/context/AuthContext';

export const MOVE_IN_TIMELINE_CHOICES = [
  'Immediately',
  'Within one month',
  'In 1–3 months',
  'Flexible',
] as const;

export type MoveInTimeline = (typeof MOVE_IN_TIMELINE_CHOICES)[number];

export interface ProfileChecklistItem {
  id: 'phone' | 'bio' | 'preferredCity' | 'monthlyBudget' | 'moveInTimeline';
  label: string;
  isComplete: boolean;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  totalItems: number;
  completedCount: number;
  percentage: number;
  missingItems: ProfileChecklistItem[];
  checklist: ProfileChecklistItem[];
}

const PHONE_REGEX = /^[+]?[0-9\s().-]{7,20}$/;

/**
 * Evaluates the 5 tenant renter profile completion checklist items:
 * 1. Contact phone number
 * 2. Short renter introduction / About me
 * 3. Preferred rental city or locality
 * 4. Monthly rental budget
 * 5. Expected move-in timeline
 *
 * Registration fields (name, email, role) alone do not constitute profile completion.
 */
export function getProfileCompletionStatus(user: User | null | undefined): ProfileCompletionStatus {
  if (!user) {
    const defaultChecklist: ProfileChecklistItem[] = [
      { id: 'phone', label: 'Contact phone number', isComplete: false },
      { id: 'bio', label: 'About me / renter introduction', isComplete: false },
      { id: 'preferredCity', label: 'Preferred city or locality', isComplete: false },
      { id: 'monthlyBudget', label: 'Monthly rental budget', isComplete: false },
      { id: 'moveInTimeline', label: 'Expected move-in timeline', isComplete: false },
    ];
    return {
      isComplete: false,
      totalItems: defaultChecklist.length,
      completedCount: 0,
      percentage: 0,
      missingItems: defaultChecklist,
      checklist: defaultChecklist,
    };
  }

  // 1. Phone check: non-empty string, valid format, 7-20 chars, 7-15 digits
  const trimmedPhone = typeof user.phone === 'string' ? user.phone.trim() : '';
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  const isPhoneComplete =
    trimmedPhone.length >= 7 &&
    trimmedPhone.length <= 20 &&
    digitsOnly.length >= 7 &&
    digitsOnly.length <= 15 &&
    PHONE_REGEX.test(trimmedPhone);

  // 2. Bio / Renter Introduction: non-empty string, at least 10 characters
  const trimmedBio = typeof user.bio === 'string' ? user.bio.trim() : '';
  const isBioComplete = trimmedBio.length >= 10 && trimmedBio.length <= 500;

  // 3. Preferred City / Locality: non-empty string, at least 2 characters
  const trimmedCity = typeof user.preferredCity === 'string' ? user.preferredCity.trim() : '';
  const isPreferredCityComplete = trimmedCity.length >= 2 && trimmedCity.length <= 100;

  // 4. Monthly Budget: positive number > 0 up to 10,000,000
  const budgetNum =
    typeof user.monthlyBudget === 'number'
      ? user.monthlyBudget
      : typeof user.monthlyBudget === 'string'
      ? parseFloat(user.monthlyBudget)
      : null;
  const isBudgetComplete =
    budgetNum !== null &&
    !isNaN(budgetNum) &&
    isFinite(budgetNum) &&
    budgetNum > 0 &&
    budgetNum <= 10000000;

  // 5. Move-in Timeline: one of the allowed choices
  const rawTimeline = typeof user.moveInTimeline === 'string' ? user.moveInTimeline.trim() : '';
  const trimmedTimeline = rawTimeline === 'In 1-3 months' ? 'In 1–3 months' : rawTimeline;
  const isTimelineComplete = (MOVE_IN_TIMELINE_CHOICES as readonly string[]).includes(trimmedTimeline);

  const checklist: ProfileChecklistItem[] = [
    { id: 'phone', label: 'Contact phone number', isComplete: isPhoneComplete },
    { id: 'bio', label: 'About me / renter introduction', isComplete: isBioComplete },
    { id: 'preferredCity', label: 'Preferred city or locality', isComplete: isPreferredCityComplete },
    { id: 'monthlyBudget', label: 'Monthly rental budget', isComplete: isBudgetComplete },
    { id: 'moveInTimeline', label: 'Expected move-in timeline', isComplete: isTimelineComplete },
  ];

  const completedCount = checklist.filter((item) => item.isComplete).length;
  const totalItems = checklist.length;
  const percentage = Math.round((completedCount / totalItems) * 100);
  const missingItems = checklist.filter((item) => !item.isComplete);
  const isComplete = completedCount === totalItems;

  return {
    isComplete,
    totalItems,
    completedCount,
    percentage,
    missingItems,
    checklist,
  };
}

/**
 * Returns true if all 5 tenant renter profile items are complete.
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  return getProfileCompletionStatus(user).isComplete;
}
