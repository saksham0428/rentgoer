'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, ArrowLeft, ShieldCheck, ShieldX, Home, User, MessageSquare, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [moderatorNote, setModeratorNote] = useState('');

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const res = await api.get<{ success: boolean; data: any }>(`/admin/reports/${id}`);
      setReport(res.data);
      setNewStatus(res.data.status);
      setModeratorNote(res.data.moderatorNote || '');
    } catch (err) {
      console.error('Failed to load report:', err);
      setError('Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === report.status && moderatorNote === report.moderatorNote) return;

    setStatusUpdating(true);
    try {
      await api.put(`/admin/reports/${id}/status`, {
        status: newStatus,
        moderatorNote: moderatorNote || null
      });
      await fetchReport();
      alert('Report updated successfully');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update report');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-danger p-8 bg-red-50 rounded-xl border border-red-100">
          <p className="font-medium">{error || 'Report not found'}</p>
          <Link href="/admin/reports" className="mt-4 inline-block">
            <Button variant="outline">Back to Reports</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'PROPERTY': return <Home className="h-5 w-5" />;
      case 'USER': return <User className="h-5 w-5" />;
      case 'MESSAGE': return <MessageSquare className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'bg-red-100 text-red-800 border-red-200';
      case 'REVIEWING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'RESOLVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'DISMISSED': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const validTransitions: Record<string, string[]> = {
    'OPEN': ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'],
    'REVIEWING': ['REVIEWING', 'RESOLVED', 'DISMISSED'],
    'RESOLVED': ['RESOLVED'],
    'DISMISSED': ['DISMISSED']
  };

  const availableStatuses = validTransitions[report.status] || [report.status];
  const isTerminal = report.status === 'RESOLVED' || report.status === 'DISMISSED';

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto space-y-6">
      <Link href="/admin/reports" className="inline-flex items-center text-sm font-medium text-muted hover:text-foreground mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Reports
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Report #{report.id.slice(0, 8)}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(report.status)}`}>
              {report.status}
            </span>
          </div>
          <p className="text-sm text-muted flex items-center">
            <Clock className="h-4 w-4 mr-1" /> Submitted {format(new Date(report.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <h3 className="text-lg font-bold text-foreground">Report Information</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Reason</p>
                <p className="text-lg font-bold text-foreground">{report.reason.replace(/_/g, ' ')}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-2">Reporter Description</p>
                <div className="bg-gray-50 p-4 rounded-lg border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{report.description}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted uppercase tracking-wider mb-2">Submitted By</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                    {report.reporter.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/admin/users/${report.reporter.id}`} className="font-semibold text-sm hover:underline">
                      {report.reporter.name}
                    </Link>
                    <p className="text-xs text-muted">{report.reporter.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Moderation Actions</h3>
            </div>
            <div className="p-6">
              {isTerminal ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-border">
                  <p className="text-sm font-medium text-foreground mb-2">This report is closed.</p>
                  <p className="text-xs text-muted mb-4">It was marked as {report.status}.</p>
                  {report.moderatorNote && (
                    <div>
                      <p className="text-xs font-bold text-muted uppercase mb-1">Moderator Note:</p>
                      <p className="text-sm italic text-foreground">{report.moderatorNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleUpdateStatus} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Action Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
                      disabled={statusUpdating}
                    >
                      {availableStatuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Moderator Note (Internal)</label>
                    <textarea
                      value={moderatorNote}
                      onChange={(e) => setModeratorNote(e.target.value)}
                      placeholder="Add notes about your decision..."
                      className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                      rows={4}
                      disabled={statusUpdating}
                    />
                  </div>
                  <Button type="submit" disabled={statusUpdating || (newStatus === report.status && moderatorNote === report.moderatorNote)}>
                    {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Moderation
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Target Context */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center gap-2">
              {getTargetIcon(report.targetType)} Target: {report.targetType}
            </h3>
            
            {report.targetType === 'PROPERTY' && report.targetProperty ? (
              <div className="space-y-3">
                <Link href={`/admin/properties/${report.targetProperty.id}`} className="block group">
                  <p className="font-bold text-primary group-hover:underline">{report.targetProperty.title}</p>
                  <p className="text-xs text-muted mt-1">{report.targetProperty.city}</p>
                </Link>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-1">Owner</p>
                  <Link href={`/admin/users/${report.targetProperty.owner.id}`} className="font-medium text-sm hover:underline">
                    {report.targetProperty.owner.name}
                  </Link>
                </div>
              </div>
            ) : report.targetType === 'USER' && report.targetUser ? (
              <div className="space-y-3">
                <Link href={`/admin/users/${report.targetUser.id}`} className="block group">
                  <p className="font-bold text-primary group-hover:underline">{report.targetUser.name}</p>
                  <p className="text-xs text-muted mt-1">{report.targetUser.email}</p>
                </Link>
                <div className="pt-3 border-t border-border flex items-center gap-2">
                  <span className="text-xs font-bold uppercase">{report.targetUser.role}</span>
                  {report.targetUser.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                </div>
              </div>
            ) : report.targetType === 'MESSAGE' && report.targetMessage ? (
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded border border-border text-sm italic">
                  &quot;{report.targetMessage.content}&quot;
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-1">Sender</p>
                  <Link href={`/admin/users/${report.targetMessage.sender.id}`} className="font-medium text-sm hover:underline">
                    {report.targetMessage.sender.name}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted italic">Target details unavailable or deleted.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
