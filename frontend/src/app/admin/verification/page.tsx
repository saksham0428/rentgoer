'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Loader2, ShieldCheck, ShieldAlert, ShieldEllipsis, Home, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (status !== 'ALL') query.append('status', status);
      if (type !== 'ALL') query.append('type', type);

      const res = await api.get<{ success: boolean; data: any[]; pagination: any }>(`/admin/verification?${query.toString()}`);
      setRequests(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load verification requests:', err);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page]); 

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRequests();
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'APPROVED': return <ShieldCheck className="h-4 w-4" />;
      case 'REJECTED': return <ShieldAlert className="h-4 w-4" />;
      case 'PENDING': return <ShieldEllipsis className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Verification Requests</h1>
        <p className="text-muted mt-2">Review identity and property verification submissions.</p>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Filters */}
        <div className="p-5 border-b border-border bg-gray-50/50">
          <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Request Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Types</option>
                <option value="OWNER">Owner Identity</option>
                <option value="PROPERTY">Property</option>
              </select>
            </div>

            <Button type="submit" className="w-full sm:w-auto h-9">
              Apply Filters
            </Button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && requests.length === 0 ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-danger font-medium">{error}</div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted">No verification requests found matching the criteria.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Owner Contact</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 p-2 rounded-md text-gray-600">
                          {req.type === 'OWNER' ? <User className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                        </div>
                        <span className="font-semibold text-sm capitalize">{req.type.toLowerCase()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-foreground">
                        {req.type === 'OWNER' ? req.owner.name : req.property?.title || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{req.owner.name}</p>
                      <p className="text-xs text-muted">{req.owner.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(req.status)}`}>
                        {getStatusIcon(req.status)} {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-muted">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {format(new Date(req.submittedAt), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/verification/${req.id}`}>
                        <Button variant={req.status === 'PENDING' ? 'primary' : 'outline'} size="sm" className="h-8 text-xs">
                          {req.status === 'PENDING' ? 'Review' : 'View'}
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
