import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MapPin, BedDouble, Bath, Home, Shield, Info, ArrowLeft, Star, BadgeCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageGallery } from '@/components/property/ImageGallery';
import { FavoriteButton } from '@/components/property/FavoriteButton';
import { RentalRequestForm } from '@/components/property/RentalRequestForm';
import { ChatWithOwnerButton } from '@/components/property/ChatWithOwnerButton';
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
        <Link href="/properties" className="inline-flex items-center text-sm font-semibold text-muted hover:text-primary transition-colors gap-2 px-3 py-1.5 rounded-lg hover:bg-stone-100 w-fit">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to all properties</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight break-words">
              {property.title}
              {property.isVerified && <BadgeCheck className="h-6 w-6 text-blue-500 inline-block ml-2 align-text-bottom" />}
            </h1>
            <FavoriteButton propertyId={property.id} className="relative z-10" />
            {!property.isAvailable && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-danger/10 text-danger uppercase tracking-wider">
                Rented
              </span>
            )}
          </div>
          <div className="flex items-center text-muted gap-4 flex-wrap text-sm sm:text-base">
            <div className="flex items-center text-muted">
              <MapPin className="h-4 w-4 mr-1 text-primary flex-shrink-0" />
              <span>{property.locality}, {property.city}</span>
            </div>
            {property.averageRating !== undefined && property.reviewCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                <span className="font-bold text-xs">{property.averageRating.toFixed(1)}</span>
                <span className="text-muted text-xs">({property.reviewCount} reviews)</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-3xl sm:text-4xl font-black text-primary tracking-tight">
            {formatCurrency(property.rent)}
            <span className="text-base sm:text-lg text-muted font-normal ml-1">/mo</span>
          </p>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="mb-10">
        <ImageGallery images={property.images || []} title={property.title} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Key Features Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-2xs">
            <h3 className="text-base font-bold text-foreground mb-4">Key Property Specifications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <span className="text-muted text-xs flex items-center font-medium"><BedDouble className="h-3.5 w-3.5 mr-1.5 text-primary" /> Bedrooms</span>
                <span className="font-bold text-lg text-foreground">{property.bedrooms}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <span className="text-muted text-xs flex items-center font-medium"><Bath className="h-3.5 w-3.5 mr-1.5 text-primary" /> Bathrooms</span>
                <span className="font-bold text-lg text-foreground">{property.bathrooms}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <span className="text-muted text-xs flex items-center font-medium"><Home className="h-3.5 w-3.5 mr-1.5 text-primary" /> Type</span>
                <span className="font-bold text-base text-foreground truncate">{formatEnum(property.propertyType)}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <span className="text-muted text-xs flex items-center font-medium"><Info className="h-3.5 w-3.5 mr-1.5 text-primary" /> Furnishing</span>
                <span className="font-bold text-base text-foreground truncate">{formatEnum(property.furnishedStatus)}</span>
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-2xs">
            <h3 className="text-xl font-bold text-foreground mb-4">About this home</h3>
            <div className="prose max-w-none text-muted leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
              {property.description}
            </div>
          </div>
          
          {/* Address details */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-2xs">
            <h3 className="text-lg font-bold text-foreground mb-3">Location & Neighborhood</h3>
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 text-muted flex items-start gap-3">
              <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
              <p className="leading-relaxed text-sm font-medium text-foreground">{property.address}</p>
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
          <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-md sticky top-24">
            <h3 className="text-xl font-extrabold text-foreground mb-6 tracking-tight">Rental Summary</h3>
            
            <div className="space-y-3.5 mb-7 text-sm">
              <div className="flex justify-between pb-3 border-b border-border/60">
                <span className="text-muted font-medium">Monthly Rent</span>
                <span className="font-bold text-foreground text-base">{formatCurrency(property.rent)}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-border/60">
                <span className="text-muted font-medium">Security Deposit</span>
                <span className="font-bold text-foreground">{formatCurrency(property.securityDeposit)}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-border/60">
                <span className="text-muted font-medium">Available From</span>
                <span className="font-semibold text-foreground">
                  {new Date(property.availableFrom).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Brokerage Commission</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">₹0 (Zero)</span>
              </div>
            </div>

            {property.isAvailable && (
              <div className="mb-4">
                <ChatWithOwnerButton
                  propertyId={property.id}
                  ownerId={property.ownerId}
                  isAvailable={property.isAvailable}
                />
              </div>
            )}

            {property.isAvailable ? (
              <RentalRequestForm propertyId={property.id} />
            ) : (
              <div className="bg-stone-50 border border-border rounded-xl p-5 text-center">
                <h3 className="text-base font-bold text-foreground mb-1">Unavailable</h3>
                <p className="text-muted text-xs leading-relaxed">This property is currently rented and not accepting new applications.</p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border/60">
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Listed By Verified Owner</h4>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="h-10 w-10 bg-primary-light text-primary rounded-full flex items-center justify-center font-bold text-sm">
                  {property.owner?.name?.charAt(0) || 'O'}
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="font-bold text-foreground text-sm truncate">{property.owner?.name || 'Verified Owner'}</p>
                  {property.owner?.isVerified && (
                    <p className="text-xs text-blue-600 flex items-center mt-0.5 font-semibold">
                      <BadgeCheck className="h-3.5 w-3.5 mr-1 text-blue-500" /> Verified Owner
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-5 flex justify-center">
                <ReportPropertyButton propertyId={property.id} ownerId={property.ownerId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
