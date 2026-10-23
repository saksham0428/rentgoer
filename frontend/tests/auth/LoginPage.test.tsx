import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
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

describe('LoginPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders form fields, submit button, and signup link', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
  });

  it('renders status message when message query param is present', () => {
    mockSearchParams = new URLSearchParams({ message: 'Session expired. Please log in again.' });
    render(<LoginPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Session expired. Please log in again.');
  });

  it('updates form values as the user types', () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'tenant@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });

    expect(emailInput.value).toBe('tenant@example.com');
    expect(passwordInput.value).toBe('Secret123!');
  });

  it('submits credentials and routes TENANT to /properties', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-1', email: 'tenant@example.com', role: 'TENANT' },
      message: 'Logged in successfully',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'tenant@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'tenant@example.com',
        password: 'password123',
      });
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/properties');
    });
  });

  it('submits credentials and routes OWNER to /owner', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-2', email: 'owner@example.com', role: 'OWNER' },
      message: 'Logged in successfully',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/owner');
    });
  });

  it('submits credentials and routes ADMIN to /admin', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-3', email: 'admin@example.com', role: 'ADMIN' },
      message: 'Logged in successfully',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });

  it('honors safe internal redirect parameter upon login', async () => {
    mockSearchParams = new URLSearchParams({ redirect: '/favorites' });
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-1', email: 'tenant@example.com', role: 'TENANT' },
      message: 'Logged in successfully',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'tenant@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/favorites');
    });
  });

  it('redirects non-admin to their designated portal when redirect attempts an /admin path', async () => {
    mockSearchParams = new URLSearchParams({ redirect: '/admin/properties' });
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      user: { id: 'usr-1', email: 'tenant@example.com', role: 'TENANT' },
      message: 'Logged in successfully',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'tenant@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/tenant');
    });
  });

  it('displays API error alert when authentication fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid email or password.'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('disables submit button and shows loading text during in-flight submission', async () => {
    let resolveLogin: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    vi.mocked(api.post).mockReturnValueOnce(pendingPromise as any);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wait@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    const submitBtn = screen.getByRole('button', { name: /logging in/i });
    expect(submitBtn).toBeDisabled();

    // Resolve login
    resolveLogin({ success: true, user: { role: 'TENANT' } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/properties');
    });
  });
});
