import React from 'react';
import Link from 'next/link';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Button } from '@/components/ui/Button';
import { Search, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { Pagination } from '@/components/property/Pagination';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Browse Properties | RentGoer',
  description: 'Explore verified rental properties with zero brokerage fees directly on RentGoer.',
};

async function getProperties(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const res = await api.get<{
      success: boolean;
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number; };
    }>('/properties', { params: searchParams });
    return res;
  } catch (error) {
    console.error('Failed to fetch properties:', error);
    return null;
  }
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const result = await getProperties(resolvedParams);

  const properties = result?.data || [];
  const pagination = result?.pagination;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow flex flex-col">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-light text-primary mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Direct Marketplace
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Browse Properties
          </h1>
          <p className="text-muted mt-2 text-base">
            Find your next home directly from verified owners with zero brokerage fees.
          </p>
        </div>
        {result && properties.length > 0 && (
          <div className="text-sm text-muted font-medium bg-card px-4 py-2 rounded-xl border border-border shadow-2xs self-start md:self-auto">
            Showing <span className="font-semibold text-foreground">{properties.length}</span> of <span className="font-semibold text-foreground">{pagination?.total}</span> homes
          </div>
        )}
      </div>

      <PropertyFilters />

      {!result && (
        <div className="text-center py-20 bg-card rounded-2xl border border-border/80 my-auto shadow-2xs p-8 max-w-xl mx-auto">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-danger" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Unable to load properties</h3>
          <p className="mt-2 text-muted text-sm mb-6">Please check your connection and try again.</p>
          <Link href="/properties">
            <Button variant="outline">Retry</Button>
          </Link>
        </div>
      )}

      {result && properties.length > 0 && (
        <>
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

          {pagination && (
            <div className="mt-8">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                searchParams={resolvedParams}
              />
            </div>
          )}
        </>
      )}

      {result && properties.length === 0 && (
        <div className="text-center py-20 bg-card rounded-2xl border border-border/80 my-auto shadow-2xs p-8 max-w-xl mx-auto">
          <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-muted">
            <Search className="h-6 w-6 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No properties found</h3>
          <p className="mt-2 text-muted text-sm mb-6 leading-relaxed">
            We couldn&apos;t find any properties matching your current filters. Try relaxing your budget or location criteria.
          </p>
          <Link href="/properties">
            <Button variant="outline">Clear all filters</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
