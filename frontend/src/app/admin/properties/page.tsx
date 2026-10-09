'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Loader2, Search, Filter, ShieldCheck, ShieldX, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import Image from 'next/image';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [isAvailable, setIsAvailable] = useState('ALL');
  const [isVerified, setIsVerified] = useState('ALL');
  const [propertyType, setPropertyType] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (search) query.append('search', search);
      if (propertyType !== 'ALL') query.append('propertyType', propertyType);
      if (isVerified !== 'ALL') query.append('isVerified', isVerified === 'VERIFIED' ? 'true' : 'false');
      if (isAvailable !== 'ALL') query.append('isAvailable', isAvailable === 'AVAILABLE' ? 'true' : 'false');

      const res = await api.get<{ success: boolean; data: any[]; pagination: any }>(`/admin/properties?${query.toString()}`);
      setProperties(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load properties:', err);
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [page]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProperties();
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Properties Management</h1>
        <p className="text-muted mt-2">View and inspect all property listings on the platform.</p>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Filters */}
        <div className="p-5 border-b border-border bg-gray-50/50">
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Title, city or locality..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Availability</label>
              <select
                value={isAvailable}
                onChange={(e) => setIsAvailable(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Rented</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Verification</label>
              <select
                value={isVerified}
                onChange={(e) => setIsVerified(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Status</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>

            <Button type="submit" className="w-full h-9">
              Apply Filters
            </Button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && properties.length === 0 ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-danger font-medium">{error}</div>
          ) : properties.length === 0 ? (
            <div className="p-12 text-center text-muted">No properties found matching the criteria.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4">Property</th>
                  <th className="px-6 py-4">Owner</th>
                  <th className="px-6 py-4">Rent / City</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Verification</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {properties.map((property) => (
                  <tr key={property.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-border">
                          {property.images && property.images.length > 0 ? (
                            <Image src={property.images[0].url} alt="" fill className="object-cover" sizes="64px" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">No Img</div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm line-clamp-1">{property.title}</p>
                          <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{property.propertyType.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">{property.owner.name}</span>
                        {property.owner.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500"  />}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{property.owner.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-foreground">₹{property.rent}</p>
                      <p className="text-xs text-muted mt-0.5">{property.city}</p>
                    </td>
                    <td className="px-6 py-4">
                      {property.isAvailable ? (
                        <span className="inline-flex items-center text-xs font-medium text-success">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-muted">
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Rented
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {property.isVerified ? (
                        <span className="inline-flex items-center text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-muted bg-muted/20 px-2 py-0.5 rounded-full">
                          <ShieldX className="w-3.5 h-3.5 mr-1 opacity-50" /> Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/properties/${property.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-gray-50/50 mt-auto">
            <span className="text-sm text-muted">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages || loading}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
