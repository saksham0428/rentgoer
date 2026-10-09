import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MapPin, BedDouble, Bath, Home, Shield, Info, ArrowLeft, Star, BadgeCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageGallery } from '@/components/property/ImageGallery';
import { FavoriteButton } from '@/components/property/FavoriteButton';
import { RentalRequestForm } from '@/components/property/RentalRequestForm';
import { PropertyReviews } from '@/components/property/PropertyReviews';
import { ReportPropertyButton } from '@/components/report/ReportPropertyButton';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProperty(id: string) {
  try {
    const res = await api.get<{ success: boolean; data: any }>(`/properties/${id}`);
    return res.data;
  } catch (error: any) {
    console.error('Failed to fetch property details:', error);
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return null;
    }
    throw error;
  }
}

export default async function PropertyDetailsPage({ params }: PageProps) {
  const { id } = await params;
  
  let property;
  try {
    property = await getProperty(id);
  } catch (err) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold text-danger mb-2">Unable to load property</h2>
        <p className="text-muted mb-6">There was a problem communicating with the server.</p>
        <Link href="/properties">
          <Button>Back to Properties</Button>
        </Link>
      </div>
    );
  }

  if (!property) {
    notFound();
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatEnum = (val: string) => {
    return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
      
      {/* Breadcrumb / Back Navigation */}
      <div className="mb-6">
        <Link href="/properties" className="inline-flex items-center text-sm font-medium text-muted hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to all properties
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {property.title}
              {property.isVerified && <BadgeCheck className="h-6 w-6 text-blue-500 inline-block"  />}
            </h1>
            <FavoriteButton propertyId={property.id} className="relative z-10" />
            {!property.isAvailable && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-danger/10 text-danger uppercase tracking-wider">
                Rented
              </span>
            )}
          </div>
          <div className="flex items-center text-muted gap-4 flex-wrap">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-1" />
              <span className="text-lg">{property.locality}, {property.city}</span>
            </div>
            {property.averageRating !== undefined && property.reviewCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold text-sm">{property.averageRating.toFixed(1)}</span>
                <span className="text-muted text-xs">({property.reviewCount} reviews)</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-4xl font-extrabold text-primary">
            {formatCurrency(property.rent)}
            <span className="text-lg text-muted font-normal">/mo</span>
          </p>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="mb-10">
        <ImageGallery images={property.images || []} title={property.title} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Key Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-border">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-sm flex items-center"><BedDouble className="h-4 w-4 mr-1" /> Bedrooms</span>
              <span className="font-semibold text-lg">{property.bedrooms}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted text-sm flex items-center"><Bath className="h-4 w-4 mr-1" /> Bathrooms</span>
              <span className="font-semibold text-lg">{property.bathrooms}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted text-sm flex items-center"><Home className="h-4 w-4 mr-1" /> Type</span>
              <span className="font-semibold text-lg">{formatEnum(property.propertyType)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted text-sm flex items-center"><Info className="h-4 w-4 mr-1" /> Furnishing</span>
              <span className="font-semibold text-lg">{formatEnum(property.furnishedStatus)}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-2xl font-bold mb-4">About this property</h3>
            <div className="prose max-w-none text-muted leading-relaxed whitespace-pre-wrap">
              {property.description}
            </div>
          </div>
          
          {/* Address details */}
          <div>
            <h3 className="text-xl font-bold mb-4">Location</h3>
            <div className="bg-card border border-border rounded-xl p-5 text-muted flex items-start gap-3">
              <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
              <p className="leading-relaxed">{property.address}</p>
            </div>
          </div>
          {/* Reviews section */}
          <PropertyReviews 
            propertyId={property.id} 
            averageRating={property.averageRating || 0} 
            reviewCount={property.reviewCount || 0} 
          />
        </div>

        {/* Action Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm sticky top-24">
            <h3 className="text-xl font-bold mb-6">Rental Details</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between pb-4 border-b border-border/50">
                <span className="text-muted">Monthly Rent</span>
                <span className="font-semibold text-foreground">{formatCurrency(property.rent)}</span>
              </div>
              <div className="flex justify-between pb-4 border-b border-border/50">
                <span className="text-muted">Security Deposit</span>
                <span className="font-semibold text-foreground">{formatCurrency(property.securityDeposit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Available From</span>
                <span className="font-semibold text-foreground">
                  {new Date(property.availableFrom).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {property.isAvailable ? (
              <RentalRequestForm propertyId={property.id} />
            ) : (
              <div className="bg-muted/10 border border-border rounded-xl p-6 shadow-sm text-center">
                <h3 className="text-lg font-bold text-foreground mb-2">Unavailable</h3>
                <p className="text-muted text-sm">This property is currently rented and not accepting new applications.</p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Listed By</h4>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  {property.owner?.name?.charAt(0) || 'O'}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{property.owner?.name || 'Verified Owner'}</p>
                  {property.owner?.isVerified && (
                    <p className="text-sm text-blue-600 flex items-center mt-0.5 font-medium">
                      <BadgeCheck className="h-4 w-4 mr-1 text-blue-500" /> Verified Owner
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <ReportPropertyButton propertyId={property.id} ownerId={property.ownerId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
