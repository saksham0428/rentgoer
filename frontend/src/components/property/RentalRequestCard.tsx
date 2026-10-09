/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MapPin, Loader2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

interface RentalRequestCardProps {
  request: any;
}

export const RentalRequestCard = ({ request }: RentalRequestCardProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const property = request.property;
  const imageUrl = property?.images?.[0]?.url || '/placeholder-property.jpg';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;

    setLoading(true);
    setError('');

    try {
      await api.delete(`/rental-requests/${request.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request.');
      setLoading(false);
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
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <Link href={`/properties/${property.id}`} className="md:w-48 lg:w-64 flex-shrink-0 relative aspect-[4/3] md:aspect-auto bg-gray-100">
          <Image
            src={imageUrl}
            alt={property.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 256px"
          />
        </Link>

        {/* Content */}
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2 gap-4">
            <Link href={`/properties/${property.id}`} className="hover:text-primary transition-colors">
              <h3 className="text-lg font-bold text-foreground line-clamp-1">{property.title}</h3>
            </Link>
            <div className="flex-shrink-0">{getStatusBadge()}</div>
          </div>
          
          <div className="flex items-center text-muted text-sm mb-4">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{property.locality}, {property.city}</span>
            <span className="mx-2">•</span>
            <span className="font-semibold text-foreground">{formatCurrency(property.rent)}/mo</span>
          </div>

          <div className="bg-muted/5 border border-border rounded-lg p-3 text-sm text-foreground mb-4">
            <p className="font-medium text-muted text-xs mb-1">Your Message:</p>
            <p className="whitespace-pre-wrap">{request.message}</p>
          </div>

          <div className="mt-auto pt-4 border-t border-border flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center text-muted text-xs">
              <Calendar className="h-4 w-4 mr-1" />
              Requested on: {new Date(request.createdAt).toLocaleDateString()}
            </div>

            <div className="flex items-center gap-3">
              {error && <span className="text-xs text-danger">{error}</span>}
              {request.status === 'COMPLETED' && (
                <Link href={`/properties/${request.property.id}`}>
                  <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
                    Write/View Review
                  </Button>
                </Link>
              )}
              {request.status === 'PENDING' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  disabled={loading}
                  className="text-danger border-danger hover:bg-danger/5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Request'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
