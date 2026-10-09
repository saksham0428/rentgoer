'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Plus, Edit, Loader2, ShieldCheck, ShieldAlert, ShieldEllipsis, ShieldX } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<any[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestingVerif, setRequestingVerif] = useState(false);
  const [propVerifLoading, setPropVerifLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      setError('forbidden');
      setDataLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [propsRes, verifRes] = await Promise.all([
          api.get<{ success: boolean; data: any[] }>('/properties/owner/me'),
          api.get<{ success: boolean; data: any[] }>('/verification/me').catch(() => ({ data: [] }))
        ]);
        setProperties(propsRes.data || []);
        setVerificationRequests((verifRes as any).data || []);
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError('unauthorized');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading, router]);

  const requestOwnerVerification = async () => {
    try {
      setRequestingVerif(true);
      const res = await api.post<{ success: boolean; data: any }>('/verification/owner', {});
      if (res.success) {
        setVerificationRequests(prev => [res.data, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to request verification');
    } finally {
      setRequestingVerif(false);
    }
  };

  const requestPropertyVerification = async (propertyId: string) => {
    try {
      setPropVerifLoading(prev => ({ ...prev, [propertyId]: true }));
      const res = await api.post<{ success: boolean; data: any }>(`/properties/${propertyId}/verification`, {});
      if (res.success) {
        setVerificationRequests(prev => [res.data, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to request property verification');
    } finally {
      setPropVerifLoading(prev => ({ ...prev, [propertyId]: false }));
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-danger mb-2">Access Denied</h2>
          <p className="text-muted mb-6">You must be registered as a Property Owner to access this dashboard.</p>
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto">
        <h3 className="text-lg font-medium text-danger">Unable to load properties</h3>
        <p className="mt-1 text-muted">There was a problem communicating with the server.</p>
      </div>
    );
  }

  const availableCount = properties.filter((p) => p.isAvailable).length;
  const unavailableCount = properties.length - availableCount;

  // Compute owner verification state
  const ownerVerifReq = verificationRequests.find(r => r.type === 'OWNER' && r.status === 'PENDING');
  const ownerRejectedReq = verificationRequests.find(r => r.type === 'OWNER' && r.status === 'REJECTED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Owner Dashboard</h1>
          <p className="text-muted mt-2">Manage your property listings and availability.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/owner/properties/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm md:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">Verification Status</h3>
            {(user as any)?.isVerified ? (
              <div className="flex items-center text-blue-600 font-bold text-xl gap-2 mt-2">
                <ShieldCheck className="h-6 w-6" /> VERIFIED
              </div>
            ) : ownerVerifReq ? (
              <div className="flex items-center text-amber-500 font-bold text-xl gap-2 mt-2">
                <ShieldEllipsis className="h-6 w-6" /> PENDING
              </div>
            ) : ownerRejectedReq ? (
              <div className="flex flex-col mt-2">
                <div className="flex items-center text-danger font-bold text-xl gap-2">
                  <ShieldAlert className="h-6 w-6" /> REJECTED
                </div>
                <p className="text-xs text-muted mt-2 mb-3 leading-relaxed">
                  Reason: {ownerRejectedReq.rejectionReason}
                </p>
                <Button variant="outline" size="sm" onClick={requestOwnerVerification} disabled={requestingVerif}>
                  {requestingVerif ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Request Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col mt-2">
                <div className="flex items-center text-muted-foreground font-bold text-xl gap-2 mb-3">
                  <ShieldX className="h-6 w-6" /> UNVERIFIED
                </div>
                <Button variant="outline" size="sm" onClick={requestOwnerVerification} disabled={requestingVerif}>
                  {requestingVerif ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Request Verification
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">Total Properties</h3>
          <p className="text-3xl font-extrabold text-foreground">{properties.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">Available</h3>
          <p className="text-3xl font-extrabold text-success">{availableCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">Rented / Unavailable</h3>
          <p className="text-3xl font-extrabold text-muted">{unavailableCount}</p>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto">
          <h3 className="text-xl font-bold text-foreground">You haven&apos;t listed any properties yet.</h3>
          <p className="mt-2 text-muted mb-8 max-w-md mx-auto">
            Start reaching thousands of tenants directly without paying any brokerage fees.
          </p>
          <Link href="/owner/properties/new">
            <Button size="lg" className="flex items-center gap-2 mx-auto">
              <Plus className="h-5 w-5" />
              Add your first property
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {properties.map((property: any) => {
            const isPropVerified = property.isVerified;
            const propVerifReq = verificationRequests.find(r => r.type === 'PROPERTY' && r.propertyId === property.id && r.status === 'PENDING');
            const propRejectedReq = verificationRequests.find(r => r.type === 'PROPERTY' && r.propertyId === property.id && r.status === 'REJECTED');
            
            return (
              <div key={property.id} className="relative group flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
                <PropertyCard
                  id={property.id}
                  title={property.title}
                  city={property.city}
                  locality={property.locality}
                  rent={property.rent}
                  bedrooms={property.bedrooms}
                  bathrooms={property.bathrooms}
                  propertyType={property.propertyType}
                  furnishedStatus={property.furnishedStatus}
                  isAvailable={property.isAvailable}
                  images={property.images}
                  isVerified={isPropVerified}
                />
                
                {/* Verification Action Bar */}
                <div className="p-3 bg-muted/30 border-t border-border mt-auto flex items-center justify-between">
                  {isPropVerified ? (
                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : propVerifReq ? (
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                      <ShieldEllipsis className="h-3.5 w-3.5" /> Pending Verification
                    </span>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      {propRejectedReq ? (
                        <span className="text-xs font-bold text-danger flex items-center gap-1 mr-2" title={propRejectedReq.rejectionReason}>
                          <ShieldAlert className="h-3.5 w-3.5" /> Rejected
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Unverified</span>
                      )}
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-7 text-xs py-0 px-2"
                        onClick={() => requestPropertyVerification(property.id)}
                        disabled={propVerifLoading[property.id]}
                      >
                        {propVerifLoading[property.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                        Verify
                      </Button>
                    </div>
                  )}
                </div>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/owner/properties/${property.id}/edit`}>
                    <div className="bg-white/90 hover:bg-white text-gray-800 p-2 rounded-full shadow-md transition-colors backdrop-blur-sm" title="Edit Property">
                      <Edit className="h-4 w-4" />
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
