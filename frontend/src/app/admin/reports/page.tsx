'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Loader2, Search, AlertTriangle, MessageSquare, Home, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('ALL');
  const [targetType, setTargetType] = useState('ALL');
  const [reason, setReason] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (status !== 'ALL') query.append('status', status);
      if (targetType !== 'ALL') query.append('targetType', targetType);
      if (reason !== 'ALL') query.append('reason', reason);

      const res = await api.get<{ success: boolean; data: any[]; pagination: any }>(`/admin/reports?${query.toString()}`);
      setReports(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page]); 

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'PROPERTY': return <Home className="h-4 w-4" />;
      case 'USER': return <User className="h-4 w-4" />;
      case 'MESSAGE': return <MessageSquare className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'bg-red-100 text-red-800';
      case 'REVIEWING': return 'bg-amber-100 text-amber-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'DISMISSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports Management</h1>
        <p className="text-muted mt-2">Moderate platform content and respond to user reports.</p>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Filters */}
        <div className="p-5 border-b border-border bg-gray-50/50">
          <form onSubmit={handleFilter} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="REVIEWING">Reviewing</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Types</option>
                <option value="PROPERTY">Property</option>
                <option value="USER">User</option>
                <option value="MESSAGE">Message</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Reasons</option>
                <option value="FRAUD">Fraud</option>
                <option value="SCAM">Scam</option>
                <option value="FAKE_LISTING">Fake Listing</option>
                <option value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="SPAM">Spam</option>
                <option value="MISLEADING_INFORMATION">Misleading Info</option>
                <option value="SAFETY_CONCERN">Safety Concern</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <Button type="submit" className="w-full h-9">
              Apply Filters
            </Button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && reports.length === 0 ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-danger font-medium">{error}</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center text-muted">No reports found matching the criteria.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4">Target</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 p-2 rounded-md text-gray-600">
                          {getTargetIcon(report.targetType)}
                        </div>
                        <span className="font-semibold text-sm capitalize">{report.targetType.toLowerCase()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-foreground">
                        {report.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-muted line-clamp-2 max-w-xs">{report.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-muted">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {format(new Date(report.createdAt), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/reports/${report.id}`}>
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
