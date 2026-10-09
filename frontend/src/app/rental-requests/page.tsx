'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ClipboardList, Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { RentalRequestCard } from '@/components/property/RentalRequestCard';
import { useAuth } from '@/context/AuthContext';

export default function RentalRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
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

    const fetchRequests = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/rental-requests/me');
        setRequests(res.data || []);
      } catch (err: any) {
        console.error('Failed to fetch rental requests:', err);
        setError('unauthorized');
      } finally {
        setDataLoading(false);
      }
    };

    fetchRequests();
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
        <h3 className="text-lg font-medium text-danger">Unable to load requests</h3>
        <p className="mt-1 text-muted">There was a problem communicating with the server.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow flex flex-col">
      <div className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          My Rental Requests
        </h1>
        <p className="text-muted mt-2">Track the status of properties you have applied for.</p>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto flex flex-col items-center justify-center">
          <ClipboardList className="h-16 w-16 text-muted/30 mb-4" />
          <h3 className="text-xl font-bold text-foreground">You haven&apos;t sent any rental requests yet.</h3>
          <p className="mt-2 text-muted mb-8 max-w-md mx-auto">
            Find your perfect home and send a request directly to the owner.
          </p>
          <Link href="/properties">
            <Button size="lg" className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Browse Properties
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((req: any) => (
            <RentalRequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
