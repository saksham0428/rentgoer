'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, ArrowLeft, ShieldCheck, ShieldX, CheckCircle, XCircle, Home, MapPin, BedDouble, Bath, FileText, Star, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { ImageGallery } from '@/components/property/ImageGallery';

export default function AdminPropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any }>(`/admin/properties/${id}`);
        setProperty(res.data);
      } catch (err) {
        console.error('Failed to load property:', err);
        setError('Failed to load property details');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-danger p-8 bg-red-50 rounded-xl border border-red-100">
          <p className="font-medium">{error || 'Property not found'}</p>
          <Link href="/admin/properties" className="mt-4 inline-block">
            <Button variant="outline">Back to Properties</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto space-y-6">
      <Link href="/admin/properties" className="inline-flex items-center text-sm font-medium text-muted hover:text-foreground mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Properties
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{property.title}</h1>
            {property.isVerified ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified Property
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/20 text-muted uppercase tracking-wider">
                <ShieldX className="w-3.5 h-3.5 mr-1" /> Unverified
              </span>
            )}
            {property.isAvailable ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                Available
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 uppercase tracking-wider">
                Rented
              </span>
            )}
          </div>
          <p className="text-sm text-muted flex items-center">
            <MapPin className="h-4 w-4 mr-1" /> {property.address}, {property.locality}, {property.city}
          </p>
        </div>

        {property.openReportsCount > 0 && (
          <Link href={`/admin/reports?targetType=PROPERTY&targetId=${property.id}`}>
            <Button variant="outline" className="border-danger text-danger hover:bg-danger/10">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {property.openReportsCount} Open Reports
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-8">
        <ImageGallery images={property.images || []} title={property.title} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4">Property Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded-lg border border-border text-center">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Rent</p>
                <p className="text-xl font-bold text-primary">₹{property.rent}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-border text-center">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Deposit</p>
                <p className="text-xl font-bold text-foreground">₹{property.securityDeposit}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-border text-center">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Type</p>
                <p className="text-sm font-bold text-foreground mt-1 capitalize">{property.propertyType.replace('_', ' ').toLowerCase()}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-border text-center">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Furnishing</p>
                <p className="text-sm font-bold text-foreground mt-1 capitalize">{property.furnishedStatus.replace('_', ' ').toLowerCase()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-foreground font-medium mb-6">
              <div className="flex items-center gap-1.5"><BedDouble className="h-5 w-5 text-muted-foreground" /> {property.bedrooms} Bedrooms</div>
              <div className="flex items-center gap-1.5"><Bath className="h-5 w-5 text-muted-foreground" /> {property.bathrooms} Bathrooms</div>
              <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                Listed {format(new Date(property.createdAt), 'MMM d, yyyy')}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-bold text-foreground mb-2">Description</h4>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{property.description}</p>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Owner Information</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold flex-shrink-0">
                {property.owner.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <Link href={`/admin/users/${property.owner.id}`} className="font-semibold text-foreground hover:underline">
                  {property.owner.name}
                </Link>
                <div className="flex items-center mt-1">
                  {property.owner.isVerified ? (
                    <span className="text-xs text-blue-600 font-medium flex items-center">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Verified Owner
                    </span>
                  ) : (
                    <span className="text-xs text-muted flex items-center">
                      <ShieldX className="h-3 w-3 mr-1" /> Unverified
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-sm space-y-2">
              <p className="flex justify-between"><span className="text-muted">Email:</span> <span className="font-medium">{property.owner.email}</span></p>
              <p className="flex justify-between"><span className="text-muted">Phone:</span> <span className="font-medium">{property.owner.phone || 'N/A'}</span></p>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Activity Overview</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted flex items-center gap-2"><FileText className="h-4 w-4" /> Rental Requests</span>
                <span className="font-bold">{property._count.rentalRequests}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted flex items-center gap-2"><Star className="h-4 w-4" /> Tenant Reviews</span>
                <span className="font-bold">{property._count.reviews}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
