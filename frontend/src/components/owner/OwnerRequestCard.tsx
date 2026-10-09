/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { MapPin, Calendar, CheckCircle2, XCircle, Phone, Mail, User, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface OwnerRequestCardProps {
  request: any;
  onUpdate: () => void;
}

export const OwnerRequestCard = ({ request, onUpdate }: OwnerRequestCardProps) => {
  const [loadingAction, setLoadingAction] = useState<'accept' | 'reject' | 'complete' | null>(null);
  const [error, setError] = useState('');

  const property = request.property;
  const tenant = request.tenant;
  const imageUrl = property?.images?.[0]?.url || '/placeholder-property.jpg';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAccept = async () => {
    if (!window.confirm('Accept this rental request? This will mark the property as unavailable and reject all other pending requests for this property.')) return;
    
    setLoadingAction('accept');
    setError('');

    try {
      await api.post(`/rental-requests/${request.id}/accept`, {});
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to accept request');
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Reject this rental request?')) return;
    
    setLoadingAction('reject');
    setError('');

    try {
      await api.post(`/rental-requests/${request.id}/reject`, {});
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
      setLoadingAction(null);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Mark this rental as completed? This will allow the tenant to leave a review.')) return;
    
    setLoadingAction('complete');
    setError('');

    try {
      await api.post(`/rental-requests/${request.id}/complete`, {});
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to complete request');
      setLoadingAction(null);
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">PENDING</span>;
      case 'ACCEPTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success">ACCEPTED</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">COMPLETED</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger/10 text-danger">REJECTED</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/20 text-muted">CANCELLED</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row">
      {/* Property Summary Side */}
      <div className="md:w-64 flex-shrink-0 bg-muted/5 border-r border-border flex flex-col">
        <Link href={`/properties/${property.id}`} className="relative aspect-video md:aspect-[4/3] bg-gray-100 block">
          <Image
            src={imageUrl}
            alt={property.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 256px"
          />
        </Link>
        <div className="p-4 flex-grow flex flex-col justify-center">
          <Link href={`/properties/${property.id}`} className="hover:text-primary transition-colors">
            <h4 className="font-bold text-foreground text-sm line-clamp-2 mb-1">{property.title}</h4>
          </Link>
          <div className="flex items-center text-muted text-xs mb-2">
            <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{property.locality}, {property.city}</span>
          </div>
          <div className="font-semibold text-primary">{formatCurrency(property.rent)}/mo</div>
        </div>
      </div>

      {/* Request Details Side */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-muted" />
              {tenant.name}
            </h3>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
              <span className="flex items-center"><Mail className="h-4 w-4 mr-1.5" />{tenant.email}</span>
              {tenant.phone && <span className="flex items-center"><Phone className="h-4 w-4 mr-1.5" />{tenant.phone}</span>}
            </div>
          </div>
          <div className="flex-shrink-0 ml-4">{getStatusBadge()}</div>
        </div>

        <div className="bg-muted/5 border border-border rounded-lg p-4 text-sm text-foreground mb-4 flex-grow">
          <p className="font-medium text-muted text-xs mb-2 uppercase tracking-wider">Message from tenant</p>
          <p className="whitespace-pre-wrap">{request.message}</p>
        </div>

        <div className="mt-auto pt-4 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center text-muted text-xs">
            <Calendar className="h-4 w-4 mr-1" />
            Received on {new Date(request.createdAt).toLocaleDateString()}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {error && <span className="text-xs text-danger mr-2">{error}</span>}
            
            {request.status === 'PENDING' ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReject}
                  disabled={loadingAction !== null}
                  className="flex-1 sm:flex-none text-danger border-danger hover:bg-danger/5"
                >
                  {loadingAction === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleAccept}
                  disabled={loadingAction !== null}
                  className="flex-1 sm:flex-none bg-success hover:bg-success/90 text-white"
                >
                  {loadingAction === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                </Button>
              </>
            ) : request.status === 'ACCEPTED' ? (
              <>
                <span className="inline-flex items-center text-sm font-semibold text-success mr-2">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Request Accepted
                </span>
                <Button 
                  size="sm"
                  onClick={handleComplete}
                  disabled={loadingAction !== null}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loadingAction === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Completed'}
                </Button>
              </>
            ) : request.status === 'COMPLETED' ? (
              <span className="inline-flex items-center text-sm font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Rental Completed
              </span>
            ) : request.status === 'REJECTED' ? (
              <span className="inline-flex items-center text-sm font-semibold text-danger">
                <XCircle className="h-4 w-4 mr-1" /> Request Rejected
              </span>
            ) : (
              <span className="inline-flex items-center text-sm font-semibold text-muted">
                <XCircle className="h-4 w-4 mr-1" /> Request Cancelled
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
