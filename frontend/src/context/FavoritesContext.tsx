'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

interface FavoritesContextType {
  favoriteIds: string[];
  toggleFavorite: (propertyId: string) => Promise<boolean>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (user?.role !== 'TENANT') {
      setFavoriteIds([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: string[] }>('/favorites/ids');
      if (res.success) {
        setFavoriteIds(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch favorite IDs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = async (propertyId: string): Promise<boolean> => {
    if (!user) return false;

    const isCurrentlyFavorited = favoriteIds.includes(propertyId);
    
    // Optimistic update
    setFavoriteIds(prev => 
      isCurrentlyFavorited 
        ? prev.filter(id => id !== propertyId) 
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
      setFavoriteIds(prev => 
        isCurrentlyFavorited 
          ? [...prev, propertyId]
          : prev.filter(id => id !== propertyId)
      );
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  };

  return (
    <FavoritesContext.Provider value={{ favoriteIds, toggleFavorite, loading }}>
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
