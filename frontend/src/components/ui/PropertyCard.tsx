import React from 'react';
import Link from 'next/link';
import { BedDouble, Bath, MapPin, Star, BadgeCheck } from 'lucide-react';
import Image from 'next/image';
import { FavoriteButton } from '../property/FavoriteButton';

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
  images: { url: string }[];
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

  const mainImage = images && images.length > 0 ? images[0].url : null;

  return (
    <Link href={`/properties/${id}`} className="group block h-full">
      <div className="bg-card rounded-xl border border-border overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30 h-full flex flex-col">
        {/* Image Area */}
        <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden">
          {mainImage ? (
            <Image
              src={mainImage}
              alt={title}

              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted">
              <span>No image available</span>
            </div>
          )}
          
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-gray-800 shadow-sm">
              {formatEnum(propertyType)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-gray-800 shadow-sm">
              {formatEnum(furnishedStatus)}
            </span>
          </div>

          {!hideFavorite && (
            <div className="absolute top-4 right-4 z-10">
              <FavoriteButton propertyId={id} />
            </div>
          )}

          {!isAvailable && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm z-0">
              <span className="px-4 py-2 bg-gray-900 text-white font-bold rounded-lg tracking-wider">
                RENTED
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2 gap-4">
            <h3 className="text-lg font-bold text-foreground line-clamp-1 flex-grow flex items-center gap-1.5">
              {title}
              {isVerified && (
                <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0"  />
              )}
            </h3>
            <p className="text-lg font-extrabold text-primary flex-shrink-0">
              {formatCurrency(rent)}<span className="text-sm text-muted font-normal">/mo</span>
            </p>
          </div>
          
          <div className="flex items-center justify-between text-muted text-sm mb-4">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="line-clamp-1">{locality}, {city}</span>
            </div>
            {averageRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
              <div className="flex items-center text-amber-500 font-medium">
                <Star className="h-3.5 w-3.5 fill-current mr-1" />
                {averageRating.toFixed(1)} <span className="text-muted ml-1 text-xs">({reviewCount})</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-border flex items-center gap-6 text-muted text-sm font-medium">
            <div className="flex items-center">
              <BedDouble className="h-4 w-4 mr-2" />
              <span>{bedrooms} Beds</span>
            </div>
            <div className="flex items-center">
              <Bath className="h-4 w-4 mr-2" />
              <span>{bathrooms} Baths</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
