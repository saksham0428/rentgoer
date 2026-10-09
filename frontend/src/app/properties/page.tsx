import React from 'react';
import Link from 'next/link';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { Pagination } from '@/components/property/Pagination';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Browse Properties | RentGoer',
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Browse Properties</h1>
        <p className="text-muted mt-2">Find your next home directly from verified owners.</p>
      </div>

      <PropertyFilters />

      {!result && (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto">
          <h3 className="text-lg font-medium text-foreground">Unable to load properties</h3>
          <p className="mt-1 text-muted">Please check your connection and try again.</p>
        </div>
      )}

      {result && properties.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted font-medium">
            Showing {properties.length} of {pagination?.total} properties
          </div>
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
              />
            ))}
          </div>

          {pagination && (
            <Pagination 
              page={pagination.page} 
              totalPages={pagination.totalPages} 
              searchParams={resolvedParams} 
            />
          )}
        </>
      )}

      {result && properties.length === 0 && (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto">
          <h3 className="text-lg font-medium text-foreground">No properties found</h3>
          <p className="mt-1 text-muted mb-6">We couldn't find any properties matching your current filters.</p>
          <Link href="/properties">
            <Button variant="outline">Clear all filters</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
