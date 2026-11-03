import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OwnerOnboardingPage from '@/app/owner/onboarding/page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/owner/onboarding',
}));

const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockAuth = {
  user: null as any,
  loading: false,
  refreshUser: vi.fn(),
  logout: mockLogout,
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

describe('OwnerOnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = {
      user: null,
      loading: false,
      refreshUser: vi.fn(),
      logout: mockLogout,
    };
  });

  it('renders guest view with owner value props, registration, and sign in links for unauthenticated visitors', () => {
    mockAuth.user = null;
    mockAuth.loading = false;
    render(<OwnerOnboardingPage />);

    expect(screen.getByRole('heading', { name: /list your property on rentgoer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register as property owner/i })).toHaveAttribute('href', '/register?role=OWNER');
    expect(screen.getByRole('link', { name: /owner sign in/i })).toHaveAttribute('href', '/login?role=OWNER');
    expect(screen.getByText(/zero broker commissions/i)).toBeInTheDocument();
  });

  it('renders detailed account separation explanation for authenticated TENANT', () => {
    mockAuth.user = {
      id: 'tenant-456',
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      role: 'TENANT',
    };
    mockAuth.loading = false;
    render(<OwnerOnboardingPage />);

    expect(screen.getByRole('heading', { name: /own a property\? list on rentgoer/i })).toBeInTheDocument();
    expect(screen.getByText(/currently signed in as/i)).toBeInTheDocument();
    expect(screen.getByText(/rohan sharma/i)).toBeInTheDocument();

    // Verify the 5 key separation facts
    expect(screen.getByText(/dedicated roles:/i)).toBeInTheDocument();
    expect(screen.getByText(/owner dashboard protection:/i)).toBeInTheDocument();
    expect(screen.getByText(/separate email requirement:/i)).toBeInTheDocument();
    expect(screen.getByText(/your tenant data remains intact:/i)).toBeInTheDocument();
    expect(screen.getByText(/easy owner setup:/i)).toBeInTheDocument();

    // Verify CTAs
    const returnBtn = screen.getByRole('link', { name: /return to tenant dashboard/i });
    expect(returnBtn).toHaveAttribute('href', '/properties');

    const createOwnerBtn = screen.getByRole('button', { name: /create owner account/i });
    expect(createOwnerBtn).toBeInTheDocument();
  });

  it('signs out tenant and navigates to owner registration when Create Owner Account is clicked', async () => {
    mockAuth.user = {
      id: 'tenant-456',
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      role: 'TENANT',
    };
    mockAuth.loading = false;
    render(<OwnerOnboardingPage />);

    const createOwnerBtn = screen.getByRole('button', { name: /create owner account/i });
    fireEvent.click(createOwnerBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/register?role=OWNER');
    });
  });

  it('renders active owner status card when already signed in as OWNER', () => {
    mockAuth.user = {
      id: 'owner-789',
      name: 'Priya Verma',
      email: 'priya@example.com',
      role: 'OWNER',
    };
    mockAuth.loading = false;
    render(<OwnerOnboardingPage />);

    expect(screen.getByRole('heading', { name: /you are an active property owner/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to owner dashboard/i })).toHaveAttribute('href', '/owner');
    expect(screen.getByRole('link', { name: /list a new property/i })).toHaveAttribute('href', '/owner/properties/new');
  });
});
