import { describe, it, expect } from 'vitest';
import {
  PROTECTED_PROPERTY_IDS,
  PROTECTED_USER_EMAILS,
  REQUIRED_CONFIRMATION_PHRASE,
  loadApprovedInventory,
} from '../../src/scripts/cleanup-production-test-data';

describe('Production Test Data Cleanup Guard (cleanup-production-test-data)', () => {
  it('hard-codes the two protected legitimate listings', () => {
    expect(PROTECTED_PROPERTY_IDS).toHaveLength(2);
    expect(PROTECTED_PROPERTY_IDS).toContain('b05f8dd2-89c4-4107-bf17-2aea9307af15');
    expect(PROTECTED_PROPERTY_IDS).toContain('e69c729b-5165-4cfe-8f84-f494f8668995');
  });

  it('hard-codes protected user emails', () => {
    expect(PROTECTED_USER_EMAILS).toContain('saksham8@gmail.com');
    expect(PROTECTED_USER_EMAILS).toContain('arijitpatra@gmail.com');
  });

  it('requires exact confirmation phrase "AUTHORIZED_PURGE_126_PROPERTIES"', () => {
    expect(REQUIRED_CONFIRMATION_PHRASE).toBe('AUTHORIZED_PURGE_126_PROPERTIES');
  });

  it('loads approved inventory with exact counts matching Phase 5.2 baseline', () => {
    const inventory = loadApprovedInventory();

    expect(inventory.candidatePropertyIds).toHaveLength(126);
    expect(inventory.candidateOwnerIds).toHaveLength(66);
    expect(inventory.candidateTestUserIds).toHaveLength(26);
    expect(inventory.candidateRentalRequestIds).toHaveLength(25);
    expect(inventory.candidateConversationIds).toHaveLength(11);
    expect(inventory.candidateMessageIds).toHaveLength(5);
    expect(inventory.candidateVerificationRequestIds).toHaveLength(3);
    expect(inventory.candidateReportIds).toHaveLength(2);
    expect(inventory.candidateNotificationIds).toHaveLength(8);

    // Verify zero intersection with protected property IDs
    for (const pid of inventory.candidatePropertyIds) {
      expect(PROTECTED_PROPERTY_IDS).not.toContain(pid);
    }
  });
});

