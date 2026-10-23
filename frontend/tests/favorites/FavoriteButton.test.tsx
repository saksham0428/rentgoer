import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoriteButton } from '@/components/property/FavoriteButton';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let mockUser: any = null;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

let mockFavoriteIds: string[] = [];
const mockToggleFavorite = vi.fn();
vi.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favoriteIds: mockFavoriteIds,
    toggleFavorite: mockToggleFavorite,
  }),
}));

describe('FavoriteButton component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockFavoriteIds = [];
  });

  it('renders nothing when current user is an OWNER', () => {
    mockUser = { id: 'own-1', role: 'OWNER' };
    const { container } = render(<FavoriteButton propertyId="prop-123" />);

    expect(container.firstChild).toBeNull();
  });

  it('redirects unauthenticated user to /login on click', () => {
    mockUser = null;
    render(<FavoriteButton propertyId="prop-123" />);

    const button = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it('renders unfavorited state when property is not in favoriteIds', () => {
    mockUser = { id: 'ten-1', role: 'TENANT' };
    mockFavoriteIds = ['prop-999'];

    render(<FavoriteButton propertyId="prop-123" />);

    const button = screen.getByRole('button', { name: /add to favorites/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders favorited state when property is in favoriteIds', () => {
    mockUser = { id: 'ten-1', role: 'TENANT' };
    mockFavoriteIds = ['prop-123'];

    render(<FavoriteButton propertyId="prop-123" />);

    const button = screen.getByRole('button', { name: /remove from favorites/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggleFavorite with propertyId when clicked by TENANT', async () => {
    mockUser = { id: 'ten-1', role: 'TENANT' };
    mockFavoriteIds = [];
    mockToggleFavorite.mockResolvedValueOnce(true);

    render(<FavoriteButton propertyId="prop-123" />);

    const button = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith('prop-123');
    });
  });

  it('disables button while toggleFavorite is pending to prevent duplicate clicks', async () => {
    mockUser = { id: 'ten-1', role: 'TENANT' };
    mockFavoriteIds = [];

    let resolveToggle: (val: boolean) => void = () => {};
    const pendingPromise = new Promise<boolean>((resolve) => {
      resolveToggle = resolve;
    });
    mockToggleFavorite.mockReturnValue(pendingPromise);

    render(<FavoriteButton propertyId="prop-123" />);

    const button = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(button);

    // Second click while pending
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);

    resolveToggle(true);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('stops event propagation so parent links are not triggered', async () => {
    mockUser = { id: 'ten-1', role: 'TENANT' };
    mockToggleFavorite.mockResolvedValueOnce(true);
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <FavoriteButton propertyId="prop-123" />
      </div>
    );

    const button = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(button);

    expect(parentClick).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalled();
    });
  });
});
