import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '@/app/register/page';
import { api } from '@/lib/api';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    refreshUser: mockRefreshUser,
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('RegisterPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders all registration fields, role selector, and submit button', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i am a\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('defaults role to OWNER when ?role=OWNER is provided in query params', () => {
    mockSearchParams = new URLSearchParams({ role: 'OWNER' });
    render(<RegisterPage />);

    const roleSelect = screen.getByLabelText(/i am a\.\.\./i) as HTMLSelectElement;
    expect(roleSelect.value).toBe('OWNER');
  });

  it('rejects password shorter than 8 characters client-side without calling API', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits valid tenant registration and routes to /properties', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-10', role: 'TENANT', name: 'Jane Doe' },
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+91 9876543210' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/i am a\.\.\./i), { target: { value: 'TENANT' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+91 9876543210',
        password: 'SecurePass123!',
        role: 'TENANT',
      });
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/properties');
    });
  });

  it('submits valid owner registration and routes to /owner', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-20', role: 'OWNER', name: 'Landlord Bob' },
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Landlord Bob' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bob@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'StrongOwnerPass123' } });
    fireEvent.change(screen.getByLabelText(/i am a\.\.\./i), { target: { value: 'OWNER' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/owner');
    });
  });

  it('displays duplicate email message when account already exists', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Email is already in use'));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Duplicate' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'dup@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'ValidPassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/account with this email already exists/i);
    });
  });

  it('displays generic API error when registration fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Server unavailable'));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'ValidPassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable');
    });
  });

  it('disables submit button during in-flight registration', async () => {
    let resolveRegistration: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveRegistration = resolve;
    });
    vi.mocked(api.post).mockReturnValueOnce(pendingPromise as any);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Pending' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'pending@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'ValidPassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeDisabled();

    resolveRegistration({ success: true, user: { role: 'TENANT' } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/properties');
    });
  });
});
