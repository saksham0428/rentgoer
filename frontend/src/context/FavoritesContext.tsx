'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

interface FavoritesContextType {
  favoriteIds: string[];
  favoriteCount: number;
  toggleFavorite: (propertyId: string) => Promise<boolean>;
  fetchFavorites: () => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user || user.role !== 'TENANT') {
      setFavoriteIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: string[] }>('/favorites/ids');
      if (res && res.success && Array.isArray(res.data)) {
        setFavoriteIds(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch favorite IDs:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role !== 'TENANT') {
      setFavoriteIds([]);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    api.get<{ success: boolean; data: string[] }>('/favorites/ids')
      .then((res) => {
        if (!isCancelled && res && res.success && Array.isArray(res.data)) {
          setFavoriteIds(res.data);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error('Failed to fetch favorite IDs:', error);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user?.id, user?.role]);

  const toggleFavorite = useCallback(async (propertyId: string): Promise<boolean> => {
    if (!user) return false;

    const isCurrentlyFavorited = favoriteIds.includes(propertyId);
    
    // Optimistic update
    setFavoriteIds((prev) => 
      isCurrentlyFavorited 
        ? prev.filter((id) => id !== propertyId) 
        : [...prev, propertyId]
    );

    try {
      if (isCurrentlyFavorited) {
        await api.delete(`/properties/${propertyId}/favorite`);
      } else {
        await api.post(`/properties/${propertyId}/favorite`, {});
      }
      return true;
    } catch (error) {
      // Revert on failure
      setFavoriteIds((prev) => 
        isCurrentlyFavorited 
          ? [...prev, propertyId]
          : prev.filter((id) => id !== propertyId)
      );
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  }, [user?.id, favoriteIds]);

  const favoriteCount = favoriteIds.length;

  const contextValue = useMemo(() => ({
    favoriteIds,
    favoriteCount,
    toggleFavorite,
    fetchFavorites,
    loading,
  }), [favoriteIds, favoriteCount, toggleFavorite, fetchFavorites, loading]);

  return (
    <FavoritesContext.Provider value={contextValue}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
