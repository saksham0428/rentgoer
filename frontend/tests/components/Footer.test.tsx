import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';
import * as AuthContextModule from '@/context/AuthContext';

let mockAuth = {
  user: null as any,
  loading: false,
  refreshUser: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Footer Component Role-Aware Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockAuth = {
      user: null,
      loading: false,
      refreshUser: vi.fn(),
      logout: vi.fn(),
    };
  });

  it('renders nothing on chat routes to preserve viewport', () => {
    mockPathname = '/chat/some-convo-id';
    const { container } = render(<Footer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders guest owner actions (List Your Property & Owner Sign In) for unauthenticated visitors', () => {
    mockAuth.user = null;
    mockAuth.loading = false;
    render(<Footer />);

    // Check Guest links
    const listPropLink = screen.getByRole('link', { name: /list your property/i });
    expect(listPropLink).toBeInTheDocument();
    expect(listPropLink).toHaveAttribute('href', '/register?role=OWNER');

    const signInLink = screen.getByRole('link', { name: /owner sign in/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute('href', '/login?role=OWNER');

    // Guest should NOT see Owner Dashboard or Admin portal
    expect(screen.queryByRole('link', { name: /owner dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin portal/i })).not.toBeInTheDocument();
  });

  it('renders attractive owner invitation and NO Owner Dashboard for authenticated TENANT', () => {
    mockAuth.user = {
      id: 'tenant-123',
      name: 'Test Tenant',
      email: 'tenant@example.com',
      role: 'TENANT',
    };
    mockAuth.loading = false;
    render(<Footer />);

    // Tenant sees invitation card
    expect(screen.getByText(/own a property\?/i)).toBeInTheDocument();
    expect(screen.getByText(/list your property on rentgoer and connect directly/i)).toBeInTheDocument();

    const ctaButton = screen.getByRole('link', { name: /become a property owner/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/owner/onboarding');

    // Tenant must NEVER see Owner Dashboard link
    expect(screen.queryByRole('link', { name: /owner dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage listings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin portal/i })).not.toBeInTheDocument();

    // Tenant can also see My Rental Requests under Marketplace
    expect(screen.getByRole('link', { name: /my rental requests/i })).toBeInTheDocument();
  });

  it('renders Owner Dashboard, List a Property, and Manage Listings for authenticated OWNER', () => {
    mockAuth.user = {
      id: 'owner-123',
      name: 'Test Owner',
      email: 'owner@example.com',
      role: 'OWNER',
    };
    mockAuth.loading = false;
    render(<Footer />);

    expect(screen.getByText(/owner management/i)).toBeInTheDocument();

    const listLink = screen.getByRole('link', { name: /list a property/i });
    expect(listLink).toBeInTheDocument();
    expect(listLink).toHaveAttribute('href', '/owner/properties/new');

    const dashLink = screen.getByRole('link', { name: /owner dashboard/i });
    expect(dashLink).toBeInTheDocument();
    expect(dashLink).toHaveAttribute('href', '/owner');

    const manageLink = screen.getByRole('link', { name: /manage listings/i });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute('href', '/owner/properties');

    // Owner should not see admin portal
    expect(screen.queryByRole('link', { name: /admin portal/i })).not.toBeInTheDocument();
  });

  it('renders admin links only for authenticated ADMIN user and hides them from tenants/guests/owners', () => {
    mockAuth.user = {
      id: 'admin-123',
      name: 'Super Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
    mockAuth.loading = false;
    render(<Footer />);

    expect(screen.getByText(/administration/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /admin portal/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: /platform reports/i })).toHaveAttribute('href', '/admin/reports');
    expect(screen.getByRole('link', { name: /verification queue/i })).toHaveAttribute('href', '/admin/verification');
  });

  it('renders neutral fallback during loading state without flashing owner dashboard', () => {
    mockAuth.user = null;
    mockAuth.loading = true;
    render(<Footer />);

    // While loading, neutral links are displayed and Owner Dashboard is NOT leaked
    expect(screen.queryByRole('link', { name: /owner dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /become a property owner/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /list your property/i })).toHaveAttribute('href', '/owner/onboarding');
  });

  it('renders all four Trust & Legal links pointing to valid content pages', () => {
    render(<Footer />);

    const guidelinesLink = screen.getByRole('link', { name: /direct lease guidelines/i });
    expect(guidelinesLink).toBeInTheDocument();
    expect(guidelinesLink).toHaveAttribute('href', '/guidelines');

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');

    const contactLink = screen.getByRole('link', { name: /contact & grievances/i });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute('href', '/contact');
  });
});
