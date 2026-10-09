'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';

interface FavoriteButtonProps {
  propertyId: string;
  className?: string;
}

export const FavoriteButton = ({ propertyId, className = '' }: FavoriteButtonProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [isPending, setIsPending] = useState(false);

  // Do not show for owners
  if (user?.role === 'OWNER') {
    return null;
  }

  const isFavorited = favoriteIds.includes(propertyId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating if inside a Link wrapper
    e.stopPropagation();

    if (!user) {
      router.push('/login');
      return;
    }

    if (isPending) return;

    setIsPending(true);
    await toggleFavorite(propertyId);
    setIsPending(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorited}
      className={`p-2 rounded-full transition-colors flex items-center justify-center bg-white/80 backdrop-blur-sm shadow-sm border border-border hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary ${className} ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <Heart 
        className={`h-5 w-5 transition-all ${
          isFavorited 
            ? 'fill-red-500 text-red-500 scale-110' 
            : 'text-gray-600 hover:text-red-500 hover:scale-110'
        }`} 
      />
    </button>
  );
};
