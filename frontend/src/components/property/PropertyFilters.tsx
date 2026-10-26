'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Filter, X } from 'lucide-react';

export const PropertyFilters = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);

  // Initialize local state from URL
  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    locality: searchParams.get('locality') || '',
    minRent: searchParams.get('minRent') || '',
    maxRent: searchParams.get('maxRent') || '',
    bedrooms: searchParams.get('bedrooms') || '',
    bathrooms: searchParams.get('bathrooms') || '',
    propertyType: searchParams.get('propertyType') || '',
    furnishedStatus: searchParams.get('furnishedStatus') || '',
    isAvailable: searchParams.get('isAvailable') || '',
    sortBy: searchParams.get('sortBy') || 'newest',
  });

  const handleChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const params = new URLSearchParams(searchParams.toString());

    // Reset page to 1 on new filter
    params.delete('page');

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`/properties?${params.toString()}`);
    setIsOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters = {
      city: '',
      locality: '',
      minRent: '',
      maxRent: '',
      bedrooms: '',
      bathrooms: '',
      propertyType: '',
      furnishedStatus: '',
      isAvailable: '',
      sortBy: 'newest',
    };
    setFilters(emptyFilters);
    router.push('/properties');
    setIsOpen(false);
  };

  return (
    <div className="w-full mb-8">
      {/* Mobile Toggle & Quick Search Container */}
      <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <form onSubmit={applyFilters} className="flex-grow flex flex-col sm:flex-row gap-2.5">
            <div className="flex-grow">
              <Input
                placeholder="City..."
                value={filters.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-grow">
              <Input
                placeholder="Locality..."
                value={filters.locality}
                onChange={(e) => handleChange('locality', e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto px-6 font-semibold">Search</Button>
          </form>
          <div className="flex gap-2.5 items-center">
            <Select
              value={filters.sortBy}
              onChange={(e) => {
                handleChange('sortBy', e.target.value);
                // Auto-apply sort
                const params = new URLSearchParams(searchParams.toString());
                params.set('sortBy', e.target.value);
                params.delete('page');
                router.push(`/properties?${params.toString()}`);
              }}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Rent: Low to High', value: 'rent_asc' },
                { label: 'Rent: High to Low', value: 'rent_desc' },
              ]}
              className="flex-grow sm:flex-grow-0 sm:w-48"
            />
            <Button
              variant="outline"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Filter className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline font-medium">More Filters</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {isOpen && (
        <div className="bg-card border border-border p-5 sm:p-7 rounded-2xl mt-4 shadow-sm">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg text-foreground tracking-tight">Advanced Filters</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min Rent"
                label="Min Rent (â‚¹)"
                value={filters.minRent}
                onChange={(e) => handleChange('minRent', e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max Rent"
                label="Max Rent (â‚¹)"
                value={filters.maxRent}
                onChange={(e) => handleChange('maxRent', e.target.value)}
              />
            </div>

            <div className="flex gap-2">
               <Select
                label="Bedrooms"
                value={filters.bedrooms}
                onChange={(e) => handleChange('bedrooms', e.target.value)}
                options={[
                  { label: 'Any', value: '' },
                  { label: '1+', value: '1' },
                  { label: '2+', value: '2' },
                  { label: '3+', value: '3' },
                  { label: '4+', value: '4' },
                ]}
              />
               <Select
                label="Bathrooms"
                value={filters.bathrooms}
                onChange={(e) => handleChange('bathrooms', e.target.value)}
                options={[
                  { label: 'Any', value: '' },
                  { label: '1+', value: '1' },
                  { label: '2+', value: '2' },
                  { label: '3+', value: '3' },
                ]}
              />
            </div>

            <Select
              label="Property Type"
              value={filters.propertyType}
              onChange={(e) => handleChange('propertyType', e.target.value)}
              options={[
                { label: 'Any Type', value: '' },
                { label: 'Apartment', value: 'APARTMENT' },
                { label: 'House', value: 'HOUSE' },
                { label: 'Room', value: 'ROOM' },
                { label: 'PG', value: 'PG' },
                { label: 'Studio', value: 'STUDIO' },
              ]}
            />

            <Select
              label="Furnishing"
              value={filters.furnishedStatus}
              onChange={(e) => handleChange('furnishedStatus', e.target.value)}
              options={[
                { label: 'Any', value: '' },
                { label: 'Furnished', value: 'FURNISHED' },
                { label: 'Semi-Furnished', value: 'SEMI_FURNISHED' },
                { label: 'Unfurnished', value: 'UNFURNISHED' },
              ]}
            />

            <Select
              label="Availability"
              value={filters.isAvailable}
              onChange={(e) => handleChange('isAvailable', e.target.value)}
              options={[
                { label: 'All Properties', value: '' },
                { label: 'Available Only', value: 'true' },
              ]}
            />
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-border/60 pt-5">
            <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto">
              Clear All
            </Button>
            <Button onClick={applyFilters} className="w-full sm:w-auto px-6 font-semibold">
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
