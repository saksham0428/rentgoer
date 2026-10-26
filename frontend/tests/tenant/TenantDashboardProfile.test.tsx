import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TenantDashboard from '@/app/tenant/page';
import * as AuthContextModule from '@/context/AuthContext';
import { api } from '@/lib/api';

// Mock API calls
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Mock PropertyCard & RentalRequestCard to keep tests focused on dashboard & profile progress card
vi.mock('@/components/ui/PropertyCard', () => ({
  PropertyCard: () => <div data-testid="property-card">PropertyCard</div>,
}));

vi.mock('@/components/property/RentalRequestCard', () => ({
  RentalRequestCard: () => <div data-testid="rental-request-card">RentalRequestCard</div>,
}));

describe('TenantDashboard - Renter Profile Progress Card', () => {
  const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/favorites') {
        return Promise.resolve({ success: true, data: [] });
      }
      if (url === '/rental-requests/me') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true });
    });
  });

  const setupAuthMock = (user: AuthContextModule.User | null, loading = false) => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user,
      loading,
      refreshUser: mockRefreshUser,
      logout: vi.fn().mockResolvedValue(undefined),
    });
  };

  const completeTenantUser: AuthContextModule.User = {
    id: 'usr-tenant-complete',
    name: 'Jane Tenant',
    email: 'jane@example.com',
    role: 'TENANT',
    avatarUrl: null, // Optional field
    phone: '+91 9876543210',
    bio: 'Software engineer looking for a peaceful 2BHK home.',
    preferredCity: 'Bangalore, Indiranagar',
    monthlyBudget: 35000,
    moveInTimeline: 'Within one month',
  };

  it('renders "Complete your renter profile" card for an empty or newly registered user', async () => {
    const emptyProfileUser: AuthContextModule.User = {
      id: 'usr-tenant-empty',
      name: 'New Tenant',
      email: 'newtenant@example.com',
      role: 'TENANT',
      phone: null,
      bio: null,
      preferredCity: null,
      monthlyBudget: null,
      moveInTimeline: null,
    };

    setupAuthMock(emptyProfileUser);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Complete your renter profile')).toBeInTheDocument();
    });

    // Check completion counter: 0 of 5 (0%)
    expect(screen.getByText('0 of 5 (0%)')).toBeInTheDocument();

    // Verify all 5 missing checklist items are listed
    expect(screen.getByText('Contact phone number')).toBeInTheDocument();
    expect(screen.getByText('About me / renter introduction')).toBeInTheDocument();
    expect(screen.getByText('Preferred city or locality')).toBeInTheDocument();
    expect(screen.getByText('Monthly rental budget')).toBeInTheDocument();
    expect(screen.getByText('Expected move-in timeline')).toBeInTheDocument();

    // Check action button
    const completeProfileBtn = screen.getByRole('link', { name: /Complete Profile/i });
    expect(completeProfileBtn).toBeInTheDocument();
    expect(completeProfileBtn).toHaveAttribute('href', '/profile');
  });

  it('renders partial completion progress and lists only the remaining missing items', async () => {
    const partialUser: AuthContextModule.User = {
      id: 'usr-tenant-partial',
      name: 'Partial User',
      email: 'partial@example.com',
      role: 'TENANT',
      phone: '+91 9876543210',
      bio: 'Tenant with phone and bio filled out.',
      preferredCity: null,
      monthlyBudget: null,
      moveInTimeline: null,
    };

    setupAuthMock(partialUser);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Complete your renter profile')).toBeInTheDocument();
    });

    // 2 items completed out of 5 = 40%
    expect(screen.getByText('2 of 5 (40%)')).toBeInTheDocument();

    // Completed items should NOT be in the "Remaining to complete" list
    expect(screen.queryByText('Contact phone number')).not.toBeInTheDocument();
    expect(screen.queryByText('About me / renter introduction')).not.toBeInTheDocument();

    // Missing items must be shown
    expect(screen.getByText('Preferred city or locality')).toBeInTheDocument();
    expect(screen.getByText('Monthly rental budget')).toBeInTheDocument();
    expect(screen.getByText('Expected move-in timeline')).toBeInTheDocument();
  });

  it('HIDES the entire progress card when all five renter profile items are valid', async () => {
    setupAuthMock(completeTenantUser);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back, Jane')).toBeInTheDocument();
    });

    // The progress card, heading, checklist, and action button must NOT be in the document
    expect(screen.queryByText('Complete your renter profile')).not.toBeInTheDocument();
    expect(screen.queryByText(/of 5/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Complete Profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to move?')).not.toBeInTheDocument();
  });

  it('immediately hides the progress card when profile state transitions from incomplete to complete', async () => {
    const incompleteUser: AuthContextModule.User = {
      ...completeTenantUser,
      monthlyBudget: null, // only budget is missing
    };

    setupAuthMock(incompleteUser);

    const { rerender } = render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Complete your renter profile')).toBeInTheDocument();
      expect(screen.getByText('4 of 5 (80%)')).toBeInTheDocument();
    });

    // Transition to 100% complete
    setupAuthMock(completeTenantUser);
    rerender(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.queryByText('Complete your renter profile')).not.toBeInTheDocument();
    });
  });

  it('re-checks and refreshes latest persisted user profile on mount', async () => {
    setupAuthMock(completeTenantUser);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });
  });
});
