'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Heart, Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role === 'OWNER') {
      setError('forbidden');
      setDataLoading(false);
      return;
    }

    const fetchFavorites = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/favorites');
        setProperties(res.data || []);
      } catch (err: any) {
        console.error('Failed to fetch favorites:', err);
        setError('unauthorized');
      } finally {
        setDataLoading(false);
      }
    };

    fetchFavorites();
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-danger mb-2">Access Denied</h2>
          <p className="text-muted mb-6">Property Owners cannot access Tenant features.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto">
        <h3 className="text-lg font-medium text-danger">Unable to load favorites</h3>
        <p className="mt-1 text-muted">There was a problem communicating with the server.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow flex flex-col">
      <div className="mb-8 pb-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 mb-2.5 border border-red-100">
            <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            <span>Saved Collection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Saved Properties
          </h1>
          <p className="text-muted mt-1.5 text-sm sm:text-base">Review and compare homes you have favorited for later.</p>
        </div>
        {properties.length > 0 && (
          <div className="text-sm text-muted font-medium bg-card px-4 py-2 rounded-xl border border-border shadow-2xs self-start sm:self-auto">
            <span className="font-bold text-foreground">{properties.length}</span> {properties.length === 1 ? 'saved property' : 'saved properties'}
          </div>
        )}
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border/80 my-auto shadow-2xs p-8 max-w-xl mx-auto flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground">You haven&apos;t saved any properties yet.</h3>
          <p className="mt-2 text-muted text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Click the heart icon on any property to save it here for easy access later.
          </p>
          <Link href="/properties">
            <Button size="lg" className="flex items-center gap-2 font-semibold">
              <Search className="h-4 w-4" />
              <span>Explore Properties</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {properties.map((property: any) => (
            <PropertyCard
              key={property.id}
              id={property.id}
              title={property.title}
              city={property.city}
              locality={property.locality}
              rent={property.rent}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              propertyType={property.propertyType}
              furnishedStatus={property.furnishedStatus}
              isAvailable={property.isAvailable}
              images={property.images}
              isVerified={property.isVerified}
              averageRating={property.averageRating}
              reviewCount={property.reviewCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
