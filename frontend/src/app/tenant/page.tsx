/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { RentalRequestCard } from '@/components/property/RentalRequestCard';
import { Loader2, Heart, ClipboardList, Home, Clock, CheckCircle2, Search, MessageSquare } from 'lucide-react';
import { getProfileCompletionStatus } from '@/lib/profile';

export default function TenantDashboard() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [favorites, setFavorites] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const hasRefreshedUserRef = useRef(false);

  const profileStatus = getProfileCompletionStatus(user);

  useEffect(() => {
    if (!hasRefreshedUserRef.current && user) {
      hasRefreshedUserRef.current = true;
      refreshUser();
    }
  }, [user, refreshUser]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role === 'OWNER') {
      router.replace('/owner');
      return;
    }

    if (user.role === 'ADMIN') {
      router.replace('/');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const [favRes, reqRes] = await Promise.all([
          api.get<{ success: boolean; data: any[] }>('/favorites'),
          api.get<{ success: boolean; data: any[] }>('/rental-requests/me')
        ]);
        setFavorites(favRes.data || []);
        setRequests(reqRes.data || []);
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'TENANT') {
    return null;
  }

  // Calculate statistics
  const totalFavorites = favorites.length;
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;
  const acceptedRequests = requests.filter(r => r.status === 'ACCEPTED').length;

  const recentFavorites = favorites.slice(0, 3);
  const recentRequests = requests.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow space-y-8">
      
      {/* 1. Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card border border-border rounded-xl p-6 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back, {user.name ? user.name.split(' ')[0] : 'User'}
          </h1>
          <p className="text-muted mt-1">Find your next place to call home.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Profile Summary (Compact) */}
          <div className="flex items-center gap-3 bg-muted/10 px-4 py-3 rounded-lg border border-border/50 max-w-full">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold flex-shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm leading-tight truncate">{user.name || 'Anonymous User'}</p>
              <p className="text-xs text-muted leading-tight truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger p-4 rounded-xl border border-danger/20 text-center">
          {error}
        </div>
      )}

      {/* 2 & 4. Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Heart className="h-4 w-4 text-red-500 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold truncate">Saved Properties</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalFavorites}</p>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-muted mb-2">
            <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold truncate">Total Requests</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalRequests}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold truncate">Pending</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{pendingRequests}</p>
        </div>

        <Link href="/rental-requests" className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col hover:border-primary/50 transition-colors group">
          <div className="flex items-center justify-between text-muted mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold group-hover:text-primary transition-colors truncate">Accepted</h3>
            </div>
            {acceptedRequests > 0 && (
              <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full flex-shrink-0">
                Active
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{acceptedRequests}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          
          {/* 5. Recent Rental Requests */}
          <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Recent Requests
              </h2>
              {totalRequests > 3 && (
                <Link href="/rental-requests" className="text-sm font-semibold text-primary hover:underline">
                  View All Requests
                </Link>
              )}
            </div>

            {recentRequests.length === 0 ? (
              <div className="text-center py-12 bg-muted/5 rounded-xl border border-border border-dashed">
                <ClipboardList className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                <h3 className="font-semibold text-foreground">No requests sent</h3>
                <p className="text-sm text-muted mt-1 mb-4">You haven&apos;t sent any rental requests yet.</p>
                <Link href="/properties">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Search className="h-4 w-4" /> Browse Properties
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map(req => (
                  <RentalRequestCard key={req.id} request={req} />
                ))}
              </div>
            )}
          </section>

          {/* 3. Recently Saved Properties */}
          <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Recently Saved
              </h2>
              {totalFavorites > 3 && (
                <Link href="/favorites" className="text-sm font-semibold text-primary hover:underline">
                  View All Saved
                </Link>
              )}
            </div>

            {recentFavorites.length === 0 ? (
              <div className="text-center py-12 bg-muted/5 rounded-xl border border-border border-dashed">
                <Heart className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                <h3 className="font-semibold text-foreground">No saved properties</h3>
                <p className="text-sm text-muted mt-1 mb-4">You haven&apos;t saved any properties yet.</p>
                <Link href="/properties">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Search className="h-4 w-4" /> Explore Properties
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentFavorites.map((property: any) => (
                  <div key={property.id} className="flex flex-col">
                    <PropertyCard
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
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 6. Quick Actions Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/properties" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Search className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Browse Properties</span>
                </div>
              </Link>
              
              <Link href="/favorites" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2 rounded-md text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <Heart className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Saved Properties</span>
                </div>
              </Link>

              <Link href="/rental-requests" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">My Requests</span>
                </div>
              </Link>
            </div>
          </div>

          {!profileStatus.isComplete && (
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-primary tracking-wide uppercase">Profile Checklist</span>
                <span className="text-xs font-bold text-foreground bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {profileStatus.completedCount} of {profileStatus.totalItems} ({profileStatus.percentage}%)
                </span>
              </div>

              <h3 className="text-base font-bold text-foreground">Complete your renter profile</h3>
              <p className="text-xs text-muted mt-1 mb-4 leading-relaxed">
                Property owners prioritize verified inquiries with complete preferences and contact information.
              </p>

              {/* Progress bar */}
              <div className="w-full bg-muted/20 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${profileStatus.percentage}%` }}
                />
              </div>

              {/* Missing items checklist */}
              {profileStatus.missingItems.length > 0 && (
                <div className="mb-5 space-y-2">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Remaining to complete:</p>
                  <ul className="space-y-1.5">
                    {profileStatus.missingItems.map((item) => (
                      <li key={item.id} className="text-xs text-foreground/80 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link href="/profile">
                <Button variant="primary" size="sm" className="w-full font-semibold">
                  Complete Profile
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
