/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { OwnerRequestCard } from '@/components/owner/OwnerRequestCard';
import { ClipboardList, Loader2, Home, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function OwnerRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRequests = async () => {
    try {
      setDataLoading(true);
      const res = await api.get<{ success: boolean; data: any[] }>('/rental-requests/owner');
      setRequests(res.data || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch owner requests:', err);
      setError('Failed to load rental requests. Please try again later.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.replace('/');
      return;
    }

    fetchRequests();
  }, [user, authLoading, router]);

  if (authLoading || (dataLoading && requests.length === 0)) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading rental requests...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'OWNER') {
    return null;
  }

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;
  const acceptedRequests = requests.filter(r => r.status === 'ACCEPTED').length;
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED').length;
  const cancelledRequests = requests.filter(r => r.status === 'CANCELLED').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow flex flex-col">
      
      {/* Header */}
      <div className="mb-8 border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Rental Requests
          </h1>
          <p className="text-muted mt-2">Manage incoming rental applications for your properties.</p>
        </div>
        <Link href="/owner">
          <Button variant="outline" className="gap-2">
            <Home className="h-4 w-4" /> My Properties
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger p-4 rounded-xl border border-danger/20 text-center mb-8">
          {error}
          <Button variant="outline" size="sm" onClick={fetchRequests} className="ml-4">Retry</Button>
        </div>
      )}

      {/* Summary Statistics */}
      {totalRequests > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Total</h3>
            <p className="text-2xl font-bold text-foreground">{totalRequests}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Pending</h3>
            <p className="text-2xl font-bold text-amber-600">{pendingRequests}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-xs font-semibold text-success uppercase tracking-wider mb-1 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1"/> Accepted</h3>
            <p className="text-2xl font-bold text-success">{acceptedRequests}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-xs font-semibold text-danger uppercase tracking-wider mb-1 flex items-center"><XCircle className="h-3 w-3 mr-1"/> Rejected</h3>
            <p className="text-2xl font-bold text-danger">{rejectedRequests}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Cancelled</h3>
            <p className="text-2xl font-bold text-muted">{cancelledRequests}</p>
          </div>
        </div>
      )}

      {/* Requests List */}
      {totalRequests === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto flex flex-col items-center justify-center">
          <ClipboardList className="h-16 w-16 text-muted/30 mb-4" />
          <h3 className="text-xl font-bold text-foreground">No rental requests yet.</h3>
          <p className="mt-2 text-muted mb-8 max-w-md mx-auto">
            When tenants apply for your properties, their requests will appear here.
          </p>
          <Link href="/owner">
            <Button size="lg" variant="outline" className="gap-2">
              <Home className="h-5 w-5" />
              View My Properties
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map(req => (
            <OwnerRequestCard 
              key={req.id} 
              request={req} 
              onUpdate={fetchRequests} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
