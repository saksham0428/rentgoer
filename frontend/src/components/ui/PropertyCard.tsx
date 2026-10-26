'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BedDouble, Bath, MapPin, Star, BadgeCheck, Camera } from 'lucide-react';
import Image from 'next/image';
import { FavoriteButton } from '../property/FavoriteButton';
import { resolvePrimaryPropertyImage, getDeterministicFallbackImage } from '@/lib/property-images';

interface PropertyCardProps {
  id: string;
  title: string;
  city: string;
  locality: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  furnishedStatus: string;
  isAvailable: boolean;
  images?: { url: string }[] | null;
  hideFavorite?: boolean;
  averageRating?: number;
  reviewCount?: number;
  isVerified?: boolean;
}

export const PropertyCard = ({
  id,
  title,
  city,
  locality,
  rent,
  bedrooms,
  bathrooms,
  propertyType,
  furnishedStatus,
  isAvailable,
  images,
  hideFavorite,
  averageRating,
  reviewCount,
  isVerified,
}: PropertyCardProps) => {
  const [imageError, setImageError] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatEnum = (val: string) => {
    return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Determine primary photo or deterministic representative fallback
  const primaryResolution = resolvePrimaryPropertyImage(images, id || title, propertyType);
  const fallback = getDeterministicFallbackImage(id || title, propertyType);

  const isUsingFallback = primaryResolution.isFallback || imageError;
  const effectiveImageUrl = isUsingFallback ? fallback.url : primaryResolution.url;
  const effectiveAlt = isUsingFallback
    ? `${title} - Representative property photography`
    : title;

  return (
    <Link href={`/properties/${id}`} className="group block h-full">
      <div className="bg-card rounded-2xl border border-border/80 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 hover:-translate-y-1 h-full flex flex-col">
        {/* Image Area - 4:3 Aspect Ratio */}
        <div className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden">
          <Image
            src={effectiveImageUrl}
            alt={effectiveAlt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={() => setImageError(true)}
          />

          {/* Top Left Metadata Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/95 text-stone-800 shadow-xs backdrop-blur-xs border border-black/5">
              {formatEnum(propertyType)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/95 text-stone-800 shadow-xs backdrop-blur-xs border border-black/5">
              {formatEnum(furnishedStatus)}
            </span>
          </div>

          {/* Top Right Favorite Button */}
          {!hideFavorite && (
            <div className="absolute top-3 right-3 z-10">
              <FavoriteButton propertyId={id} />
            </div>
          )}

          {/* Bottom Left: Subtle Illustrative Image Badge */}
          {isUsingFallback && (
            <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-stone-900/80 text-stone-100 backdrop-blur-xs border border-white/10 shadow-xs">
                <Camera className="h-3 w-3 text-stone-300" />
                Illustrative image
              </span>
            </div>
          )}

          {/* Availability Overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center backdrop-blur-xs z-10">
              <span className="px-4 py-1.5 bg-stone-900/90 text-white font-bold rounded-full text-xs tracking-wider uppercase border border-white/20 shadow-md">
                RENTED
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2 gap-3">
            <h3 className="text-base sm:text-lg font-bold text-foreground line-clamp-1 flex-grow flex items-center gap-1.5 group-hover:text-primary transition-colors">
              {title}
              {isVerified && (
                <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
            </h3>
            <p className="text-lg sm:text-xl font-extrabold text-primary flex-shrink-0 tracking-tight">
              {formatCurrency(rent)}<span className="text-xs text-muted font-normal ml-0.5">/mo</span>
            </p>
          </div>
          
          <div className="flex items-center justify-between text-muted text-xs sm:text-sm mb-4">
            <div className="flex items-center text-muted">
              <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-muted/80" />
              <span className="line-clamp-1">{locality}, {city}</span>
            </div>
            {averageRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
              <div className="flex items-center text-amber-600 font-semibold text-xs">
                <Star className="h-3.5 w-3.5 fill-current mr-1 text-amber-500" />
                {averageRating.toFixed(1)} <span className="text-muted ml-1 text-xs font-normal">({reviewCount})</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-3.5 border-t border-border/70 flex items-center gap-6 text-muted text-xs font-medium">
            <div className="flex items-center">
              <BedDouble className="h-3.5 w-3.5 mr-1.5 text-muted/80" />
              <span>{bedrooms} Beds</span>
            </div>
            <div className="flex items-center">
              <Bath className="h-3.5 w-3.5 mr-1.5 text-muted/80" />
              <span>{bathrooms} Baths</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
