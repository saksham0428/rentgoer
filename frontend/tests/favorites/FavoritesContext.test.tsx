import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoritesProvider, useFavorites } from '@/context/FavoritesContext';
import { api } from '@/lib/api';

let mockUser: any = null;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const TestConsumer = ({ toggleId = 'prop-new' }: { toggleId?: string }) => {
  const { favoriteIds, favoriteCount, toggleFavorite, loading } = useFavorites();
  return (
    <div>
      <span data-testid="count">{favoriteCount}</span>
      <span data-testid="ids">{favoriteIds.join(',')}</span>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <button data-testid="toggle-btn" onClick={() => toggleFavorite(toggleId)}>
        Toggle Favorite
      </button>
    </div>
  );
};

describe('FavoritesContext provider & hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
  });

  it('throws an error if useFavorites is consumed outside of FavoritesProvider', () => {
    // Suppress React error boundary console log for this intentional test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useFavorites must be used within a FavoritesProvider'
    );

    consoleSpy.mockRestore();
  });

  it('initializes with empty favorites when user is unauthenticated', () => {
    mockUser = null;

    render(
      <FavoritesProvider>
        <TestConsumer />
      </FavoritesProvider>
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('ids')).toHaveTextContent('');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('fetches favorite IDs on mount when user is a TENANT', async () => {
    mockUser = { id: 'usr-tenant', role: 'TENANT' };
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: ['prop-10', 'prop-20'],
    });

    render(
      <FavoritesProvider>
        <TestConsumer />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/favorites/ids');
      expect(screen.getByTestId('count')).toHaveTextContent('2');
      expect(screen.getByTestId('ids')).toHaveTextContent('prop-10,prop-20');
    });
  });

  it('optimistically adds a property to favorites and calls api.post', async () => {
    mockUser = { id: 'usr-tenant', role: 'TENANT' };
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: ['prop-1'],
    });
    vi.mocked(api.post).mockResolvedValueOnce({ success: true });

    render(
      <FavoritesProvider>
        <TestConsumer toggleId="prop-2" />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ids')).toHaveTextContent('prop-1');
    });

    fireEvent.click(screen.getByTestId('toggle-btn'));

    // Optimistic addition is visible immediately
    expect(screen.getByTestId('ids')).toHaveTextContent('prop-1,prop-2');
    expect(screen.getByTestId('count')).toHaveTextContent('2');

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/properties/prop-2/favorite', {});
    });
  });

  it('optimistically removes an existing favorite and calls api.delete', async () => {
    mockUser = { id: 'usr-tenant', role: 'TENANT' };
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: ['prop-1', 'prop-2'],
    });
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    render(
      <FavoritesProvider>
        <TestConsumer toggleId="prop-1" />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ids')).toHaveTextContent('prop-1,prop-2');
    });

    fireEvent.click(screen.getByTestId('toggle-btn'));

    // Optimistic removal
    expect(screen.getByTestId('ids')).toHaveTextContent('prop-2');
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/properties/prop-1/favorite');
    });
  });

  it('reverts optimistic addition if the API post rejects with an error', async () => {
    mockUser = { id: 'usr-tenant', role: 'TENANT' };
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: ['prop-1'],
    });
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network failure'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <FavoritesProvider>
        <TestConsumer toggleId="prop-failed" />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ids')).toHaveTextContent('prop-1');
    });

    fireEvent.click(screen.getByTestId('toggle-btn'));

    // Initially updated optimistically
    expect(screen.getByTestId('ids')).toHaveTextContent('prop-1,prop-failed');

    // Reverts after rejection
    await waitFor(() => {
      expect(screen.getByTestId('ids')).toHaveTextContent('prop-1');
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    consoleError.mockRestore();
  });
});
