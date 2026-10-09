'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, ShieldEllipsis, User, Home, Clock, AlertTriangle, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { ImageGallery } from '@/components/property/ImageGallery';

export default function AdminVerificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const fetchRequest = async () => {
    try {
      const res = await api.get<{ success: boolean; data: any }>(`/admin/verification/${id}`);
      setReq(res.data);
    } catch (err) {
      console.error('Failed to load request:', err);
      setError('Failed to load verification request');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this verification request?')) return;
    
    setActionLoading(true);
    try {
      await api.put(`/admin/verification/${id}/approve`, {});
      await fetchRequest();
      alert('Approved successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    if (!confirm('Are you sure you want to reject this request?')) return;
    
    setActionLoading(true);
    try {
      await api.put(`/admin/verification/${id}/reject`, {
        rejectionReason
      });
      await fetchRequest();
      setShowRejectInput(false);
      alert('Rejected successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-danger p-8 bg-red-50 rounded-xl border border-red-100">
          <p className="font-medium">{error || 'Request not found'}</p>
          <Link href="/admin/verification" className="mt-4 inline-block">
            <Button variant="outline">Back to Requests</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'APPROVED': return <ShieldCheck className="h-5 w-5" />;
      case 'REJECTED': return <ShieldAlert className="h-5 w-5" />;
      case 'PENDING': return <ShieldEllipsis className="h-5 w-5" />;
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
    <div className="p-4 md:p-8 w-full max-w-5xl mx-auto space-y-6">
      <Link href="/admin/verification" className="inline-flex items-center text-sm font-medium text-muted hover:text-foreground mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Verification
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              {req.type === 'OWNER' ? <User className="h-7 w-7 text-primary" /> : <Home className="h-7 w-7 text-primary" />}
              {req.type.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} Verification
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(req.status)}`}>
              {getStatusIcon(req.status)} {req.status}
            </span>
          </div>
          <p className="text-sm text-muted flex items-center">
            <Clock className="h-4 w-4 mr-1" /> Submitted {format(new Date(req.submittedAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Context Details */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-foreground">Subject Details</h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Owner Info (Always present) */}
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Owner Profile</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {req.owner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/admin/users/${req.owner.id}`} className="font-semibold text-sm hover:underline">
                      {req.owner.name}
                    </Link>
                    <p className="text-xs text-muted">{req.owner.email}</p>
                  </div>
                  <div className="ml-auto">
                    {req.owner.isVerified ? (
                      <span className="inline-flex items-center text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified Owner
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-muted bg-muted/20 px-2 py-0.5 rounded-full">
                        <ShieldX className="w-3.5 h-3.5 mr-1" /> Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Property Info (If applicable) */}
              {req.type === 'PROPERTY' && req.property && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Property Profile</p>
                  <div className="bg-gray-50 p-4 rounded-lg border border-border">
                    <Link href={`/admin/properties/${req.property.id}`} className="block group mb-2">
                      <h4 className="font-bold text-primary group-hover:underline">{req.property.title}</h4>
                      <p className="text-sm text-muted">{req.property.city}, {req.property.locality}</p>
                    </Link>
                    <div className="flex items-center">
                      {req.property.isVerified ? (
                        <span className="inline-flex items-center text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified Property
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-muted bg-muted/20 px-2 py-0.5 rounded-full">
                          <ShieldX className="w-3.5 h-3.5 mr-1" /> Unverified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Review History */}
          {(req.status === 'APPROVED' || req.status === 'REJECTED') && (
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-gray-50/50">
                <h3 className="text-lg font-bold text-foreground">Review Result</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Reviewed By Admin ID</p>
                  <p className="text-sm font-medium">{req.reviewedById || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Reviewed On</p>
                  <p className="text-sm font-medium">{req.reviewedAt ? format(new Date(req.reviewedAt), 'MMM d, yyyy h:mm a') : 'N/A'}</p>
                </div>
                {req.status === 'REJECTED' && req.rejectionReason && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-danger uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Rejection Reason
                    </p>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-danger">
                      {req.rejectionReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel / Evidence */}
        <div className="space-y-6">
          {req.status === 'PENDING' ? (
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden border-t-4 border-t-amber-400">
              <div className="p-6 border-b border-border bg-amber-50/30">
                <h3 className="text-lg font-bold text-foreground">Moderation Action</h3>
                <p className="text-sm text-muted mt-1">Review the details and approve or reject this request.</p>
              </div>
              
              <div className="p-6 space-y-6">
                {!showRejectInput ? (
                  <div className="flex gap-4">
                    <Button 
                      className="flex-1 bg-success hover:bg-success/90 text-white border-transparent" 
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Approve Request
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-danger text-danger hover:bg-danger/10"
                      onClick={handleReject}
                      disabled={actionLoading}
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Reject Request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">Reason for Rejection</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this verification is being rejected. This will be shown to the user."
                        className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-danger focus:border-danger outline-none resize-none"
                        rows={4}
                        disabled={actionLoading}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        className="bg-danger hover:bg-danger/90 text-white"
                        onClick={handleReject}
                        disabled={actionLoading || !rejectionReason.trim()}
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Rejection
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setShowRejectInput(false)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-border rounded-xl p-6 text-center">
              <ShieldCheck className="h-12 w-12 text-muted mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-bold text-foreground">Action Completed</h3>
              <p className="text-sm text-muted mt-1">This request has already been processed.</p>
            </div>
          )}

          {/* Property Evidence if property verification */}
          {req.type === 'PROPERTY' && req.property?.images?.length > 0 && (
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-gray-50/50">
                <h3 className="text-sm font-bold text-foreground">Property Images</h3>
              </div>
              <div className="p-4">
                <ImageGallery images={req.property.images} title={req.property.title} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
